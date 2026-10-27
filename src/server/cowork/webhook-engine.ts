import crypto from 'node:crypto';
import { prReviewer, PrReviewReport } from './pr-reviewer';

export interface WebhookDeliveryRecord {
  id: string;
  provider: 'github' | 'gitlab' | 'simulated';
  event: string;
  action?: string;
  deliveryId: string;
  receivedAt: string;
  status: 'success' | 'ignored' | 'failed';
  repository?: string;
  summary: string;
  latencyMs: number;
  details?: {
    prNumber?: number;
    issueNumber?: number;
    reviewReport?: PrReviewReport;
    author?: string;
    branch?: string;
    commitCount?: number;
    [key: string]: any;
  };
  error?: string;
}

export interface WebhookProcessingResult {
  status: 'success' | 'ignored' | 'failed';
  summary: string;
  details?: Record<string, any>;
  error?: string;
}

/**
 * Validates a GitHub webhook HMAC SHA-256 signature using timing-safe comparison.
 */
export function verifyGitHubSignature(
  rawBody: string | Buffer,
  signatureHeader: string | undefined,
  secret: string
): boolean {
  if (!signatureHeader || !secret) return false;

  const parts = signatureHeader.split('=');
  if (parts.length !== 2 || parts[0] !== 'sha256') {
    return false;
  }

  const receivedSig = parts[1];
  const hmac = crypto.createHmac('sha256', secret);
  hmac.update(typeof rawBody === 'string' ? rawBody : rawBody.toString('utf8'));
  const computedSig = hmac.digest('hex');

  const receivedBuf = Buffer.from(receivedSig, 'utf8');
  const computedBuf = Buffer.from(computedSig, 'utf8');

  if (receivedBuf.length !== computedBuf.length) {
    return false;
  }

  return crypto.timingSafeEqual(receivedBuf, computedBuf);
}

/**
 * Validates a GitLab webhook token header using timing-safe comparison.
 */
export function verifyGitLabToken(tokenHeader: string | undefined, secret: string): boolean {
  if (!tokenHeader || !secret) return false;

  const tokenBuf = Buffer.from(tokenHeader, 'utf8');
  const secretBuf = Buffer.from(secret, 'utf8');

  if (tokenBuf.length !== secretBuf.length) {
    return false;
  }

  return crypto.timingSafeEqual(tokenBuf, secretBuf);
}

export class WebhookEngine {
  private deliveries: WebhookDeliveryRecord[] = [];
  private readonly maxDeliveries = 200;

  /**
   * Processes an incoming GitHub webhook event.
   */
  async handleGitHubWebhook(
    event: string,
    deliveryId: string,
    payload: any,
    options?: {
      rawBody?: string | Buffer;
      signature?: string;
      secret?: string;
    }
  ): Promise<WebhookDeliveryRecord> {
    const startTime = Date.now();
    const id = `del_gh_${Date.now()}_${crypto.randomBytes(6).toString('hex')}`;
    const repoName = payload?.repository?.full_name || payload?.repository?.name || 'unknown/repository';
    const action = payload?.action;

    // Signature verification check if secret is configured or passed
    const activeSecret = options?.secret || process.env.GITHUB_WEBHOOK_SECRET;
    if (activeSecret && options?.signature && options?.rawBody) {
      const isValid = verifyGitHubSignature(options.rawBody, options.signature, activeSecret);
      if (!isValid) {
        const failedRecord: WebhookDeliveryRecord = {
          id,
          provider: 'github',
          event,
          action,
          deliveryId,
          receivedAt: new Date().toISOString(),
          status: 'failed',
          repository: repoName,
          summary: 'Invalid HMAC signature header (X-Hub-Signature-256 verification failed)',
          latencyMs: Date.now() - startTime,
          error: 'HMAC_VERIFICATION_FAILED',
        };
        this.recordDelivery(failedRecord);
        return failedRecord;
      }
    }

    try {
      let result: WebhookProcessingResult;

      switch (event) {
        case 'ping': {
          result = {
            status: 'success',
            summary: `Ping received from GitHub hook ${payload?.hook_id || 'unknown'} (${payload?.zen || 'No zen'})`,
            details: { hookId: payload?.hook_id, zen: payload?.zen },
          };
          break;
        }

        case 'pull_request': {
          const pr = payload?.pull_request;
          const prNumber = pr?.number || payload?.number;
          const title = pr?.title || 'Untitled Pull Request';
          const author = pr?.user?.login || 'unknown';
          const baseBranch = pr?.base?.ref || 'main';
          const headBranch = pr?.head?.ref || 'unknown';

          if (['opened', 'synchronize', 'reopened'].includes(action)) {
            // Run PR Reviewer analysis on PR diff if provided or synthetic diff
            const diffContent =
              payload?.diff ||
              pr?.diff ||
              `diff --git a/src/index.ts b/src/index.ts\nindex 0000000..1111111 100644\n--- a/src/index.ts\n+++ b/src/index.ts\n@@ -1,5 +1,5 @@\n-export const version = '1.0.0';\n+export const version = '1.1.0';\n`;

            const reviewReport = prReviewer.evaluateDiff(diffContent);

            result = {
              status: 'success',
              summary: `Autonomous review completed for PR #${prNumber} "${title}" (${action}) - Status: ${reviewReport.status}, ${reviewReport.totalFindings} findings found (score: ${reviewReport.overallScore}/100)`,
              details: {
                prNumber,
                title,
                author,
                baseBranch,
                headBranch,
                reviewReport,
              },
            };
          } else {
            result = {
              status: 'ignored',
              summary: `PR #${prNumber} action "${action}" ignored (not actionable)`,
              details: { prNumber, action },
            };
          }
          break;
        }

        case 'issues': {
          const issue = payload?.issue;
          const issueNumber = issue?.number || payload?.number;
          const title = issue?.title || 'Untitled Issue';
          const author = issue?.user?.login || 'unknown';

          if (['opened', 'labeled', 'reopened'].includes(action)) {
            result = {
              status: 'success',
              summary: `Autonomous triage registered for Issue #${issueNumber}: "${title}" by @${author}`,
              details: {
                issueNumber,
                title,
                author,
                action,
                labels: (issue?.labels || []).map((l: any) => (typeof l === 'string' ? l : l.name)),
              },
            };
          } else {
            result = {
              status: 'ignored',
              summary: `Issue #${issueNumber} action "${action}" ignored`,
              details: { issueNumber, action },
            };
          }
          break;
        }

        case 'push': {
          const ref = payload?.ref || 'unknown';
          const commits = payload?.commits || [];
          const pusher = payload?.pusher?.name || payload?.pusher?.username || 'unknown';

          result = {
            status: 'success',
            summary: `Tracked push to ${ref} by @${pusher} with ${commits.length} commits`,
            details: {
              ref,
              pusher,
              commitCount: commits.length,
              headCommit: payload?.after,
            },
          };
          break;
        }

        default: {
          result = {
            status: 'ignored',
            summary: `Unhandled event type "${event}" (${action || 'no action'}) ignored`,
            details: { event, action },
          };
          break;
        }
      }

      const record: WebhookDeliveryRecord = {
        id,
        provider: 'github',
        event,
        action,
        deliveryId,
        receivedAt: new Date().toISOString(),
        status: result.status,
        repository: repoName,
        summary: result.summary,
        latencyMs: Date.now() - startTime,
        details: result.details,
      };

      this.recordDelivery(record);
      return record;
    } catch (err: any) {
      const errorRecord: WebhookDeliveryRecord = {
        id,
        provider: 'github',
        event,
        action,
        deliveryId,
        receivedAt: new Date().toISOString(),
        status: 'failed',
        repository: repoName,
        summary: `Error processing GitHub event "${event}": ${err.message || String(err)}`,
        latencyMs: Date.now() - startTime,
        error: err.message || String(err),
      };
      this.recordDelivery(errorRecord);
      return errorRecord;
    }
  }

  /**
   * Processes an incoming GitLab webhook event.
   */
  async handleGitLabWebhook(
    event: string,
    payload: any,
    options?: {
      tokenHeader?: string;
      secret?: string;
    }
  ): Promise<WebhookDeliveryRecord> {
    const startTime = Date.now();
    const id = `del_gl_${Date.now()}_${crypto.randomBytes(6).toString('hex')}`;
    const deliveryId = payload?.event_id || `gl_${Date.now()}`;
    const repoName = payload?.project?.path_with_namespace || payload?.project?.name || 'unknown/project';

    const activeSecret = options?.secret || process.env.GITLAB_WEBHOOK_SECRET;
    if (activeSecret && options?.tokenHeader) {
      const isValid = verifyGitLabToken(options.tokenHeader, activeSecret);
      if (!isValid) {
        const failedRecord: WebhookDeliveryRecord = {
          id,
          provider: 'gitlab',
          event,
          deliveryId,
          receivedAt: new Date().toISOString(),
          status: 'failed',
          repository: repoName,
          summary: 'Invalid GitLab token header (X-Gitlab-Token verification failed)',
          latencyMs: Date.now() - startTime,
          error: 'TOKEN_VERIFICATION_FAILED',
        };
        this.recordDelivery(failedRecord);
        return failedRecord;
      }
    }

    try {
      let result: WebhookProcessingResult;

      if (event === 'Merge Request Hook') {
        const mr = payload?.object_attributes;
        const mrIid = mr?.iid || mr?.id;
        const title = mr?.title || 'Untitled MR';
        const action = mr?.action || 'update';
        const author = payload?.user?.username || 'unknown';

        if (['open', 'reopen', 'update'].includes(action)) {
          const diffContent =
            payload?.diff ||
            `diff --git a/src/app.py b/src/app.py\nindex 0000000..1111111 100644\n--- a/src/app.py\n+++ b/src/app.py\n@@ -1,3 +1,3 @@\n-def run(): pass\n+def run(): return True\n`;

          const reviewReport = prReviewer.evaluateDiff(diffContent);

          result = {
            status: 'success',
            summary: `Autonomous review completed for GitLab MR !${mrIid} "${title}" (${action}) - Status: ${reviewReport.status} (score: ${reviewReport.overallScore}/100)`,
            details: {
              prNumber: mrIid,
              title,
              author,
              reviewReport,
            },
          };
        } else {
          result = {
            status: 'ignored',
            summary: `GitLab MR !${mrIid} action "${action}" ignored`,
            details: { prNumber: mrIid, action },
          };
        }
      } else if (event === 'Issue Hook') {
        const issue = payload?.object_attributes;
        const issueIid = issue?.iid || issue?.id;
        const title = issue?.title || 'Untitled Issue';
        const action = issue?.action || 'open';

        result = {
          status: 'success',
          summary: `Triage registered for GitLab Issue #${issueIid}: "${title}" (${action})`,
          details: {
            issueNumber: issueIid,
            title,
            action,
          },
        };
      } else if (event === 'Push Hook') {
        const ref = payload?.ref || 'unknown';
        const commits = payload?.commits || [];

        result = {
          status: 'success',
          summary: `Tracked GitLab push to ${ref} with ${commits.length} commits`,
          details: {
            branch: ref,
            commitCount: commits.length,
          },
        };
      } else {
        result = {
          status: 'ignored',
          summary: `Unhandled GitLab event "${event}" ignored`,
          details: { event },
        };
      }

      const record: WebhookDeliveryRecord = {
        id,
        provider: 'gitlab',
        event,
        deliveryId,
        receivedAt: new Date().toISOString(),
        status: result.status,
        repository: repoName,
        summary: result.summary,
        latencyMs: Date.now() - startTime,
        details: result.details,
      };

      this.recordDelivery(record);
      return record;
    } catch (err: any) {
      const errorRecord: WebhookDeliveryRecord = {
        id,
        provider: 'gitlab',
        event,
        deliveryId,
        receivedAt: new Date().toISOString(),
        status: 'failed',
        repository: repoName,
        summary: `Error processing GitLab event "${event}": ${err.message || String(err)}`,
        latencyMs: Date.now() - startTime,
        error: err.message || String(err),
      };
      this.recordDelivery(errorRecord);
      return errorRecord;
    }
  }

  /**
   * Simulates a webhook delivery locally without public network ingress.
   */
  async simulateEvent(
    provider: 'github' | 'gitlab',
    event: string,
    payload: any
  ): Promise<WebhookDeliveryRecord> {
    const deliveryId = `sim_${Date.now()}_${crypto.randomBytes(4).toString('hex')}`;
    if (provider === 'github') {
      return this.handleGitHubWebhook(event, deliveryId, payload);
    } else {
      return this.handleGitLabWebhook(event, payload);
    }
  }

  /**
   * Returns list of recorded webhook deliveries, sorted latest first.
   */
  getDeliveries(limit: number = 50): WebhookDeliveryRecord[] {
    return this.deliveries.slice(0, Math.min(limit, this.maxDeliveries));
  }

  /**
   * Looks up a specific delivery record by ID.
   */
  getDeliveryById(id: string): WebhookDeliveryRecord | undefined {
    return this.deliveries.find((d) => d.id === id);
  }

  /**
   * Resets delivery history (useful for clean unit tests).
   */
  clearDeliveries(): void {
    this.deliveries = [];
  }

  private recordDelivery(record: WebhookDeliveryRecord): void {
    this.deliveries.unshift(record);
    if (this.deliveries.length > this.maxDeliveries) {
      this.deliveries.pop();
    }
  }
}

export const webhookEngine = new WebhookEngine();
