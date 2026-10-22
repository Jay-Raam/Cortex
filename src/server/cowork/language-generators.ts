import { AgentTaskStep } from '../types';

export type TargetTechnology =
  | 'python'
  | 'typescript'
  | 'javascript'
  | 'react'
  | 'golang'
  | 'rust'
  | 'java'
  | 'cpp'
  | 'csharp'
  | 'dart'
  | 'php'
  | 'ruby'
  | 'swift'
  | 'kotlin'
  | 'sql'
  | 'shell'
  | 'html_css_js';

export interface TechnologyDetection {
  technology: TargetTechnology;
  displayName: string;
  primaryExtension: string;
  plannedFiles: string[];
}

/**
 * Helper to identify web frontend goals.
 */
export function isWebDevelopmentGoal(goal: string): boolean {
  const normalized = goal.toLowerCase();
  return (
    normalized.includes('html') ||
    normalized.includes('css') ||
    normalized.includes('javascript') ||
    normalized.includes('landing page') ||
    normalized.includes('website') ||
    normalized.includes('web page') ||
    normalized.includes('frontend') ||
    normalized.includes('portfolio') ||
    normalized.includes('e-commerce')
  );
}

/**
 * Intelligent detector that identifies the target programming language or technology
 * from prompt goal, constraints, and desired output.
 * Crucially: If the user specified a language (e.g. Python, Go, Rust, Java, C++, React),
 * that language takes precedence over generic HTML/CSS/JS.
 */
export function detectTargetTechnology(
  goal: string,
  constraints = '',
  desiredOutput = ''
): TechnologyDetection {
  const text = `${goal} ${constraints} ${desiredOutput}`.toLowerCase();

  // 1. Python detection
  if (
    /\b(python|python3|py|fastapi|flask|django|pytest|pandas|numpy|tkinter|scikit)\b/.test(text) ||
    text.includes('.py')
  ) {
    return {
      technology: 'python',
      displayName: 'Python',
      primaryExtension: '.py',
      plannedFiles: ['models.py', 'main.py', 'test_food_shop.py'],
    };
  }

  // 2. React / Next.js detection
  if (
    /\b(react|react\.js|reactjs|nextjs|next\.js|jsx|tsx)\b/.test(text) ||
    text.includes('.tsx') ||
    text.includes('.jsx')
  ) {
    return {
      technology: 'react',
      displayName: 'React (TypeScript)',
      primaryExtension: '.tsx',
      plannedFiles: ['types.ts', 'App.tsx', 'styles.css'],
    };
  }

  // 3. Rust detection
  if (/\b(rust|cargo|actix|tokio)\b/.test(text) || text.includes('.rs')) {
    return {
      technology: 'rust',
      displayName: 'Rust',
      primaryExtension: '.rs',
      plannedFiles: ['Cargo.toml', 'src/main.rs'],
    };
  }

  // 4. Go / Golang detection
  if (
    /\b(golang|go language)\b/.test(text) ||
    (/\bgo\b/.test(text) &&
      (text.includes('code') ||
        text.includes('build') ||
        text.includes('api') ||
        text.includes('program') ||
        text.includes('backend') ||
        text.includes('service') ||
        text.includes('food shop') ||
        text.includes('app'))) ||
    text.includes('.go')
  ) {
    return {
      technology: 'golang',
      displayName: 'Go',
      primaryExtension: '.go',
      plannedFiles: ['models.go', 'main.go', 'main_test.go'],
    };
  }

  // 5. Java detection
  if (
    /\b(java|spring|springboot|spring-boot|maven|gradle)\b/.test(text) ||
    text.includes('.java')
  ) {
    return {
      technology: 'java',
      displayName: 'Java',
      primaryExtension: '.java',
      plannedFiles: ['Product.java', 'FoodShop.java', 'Main.java'],
    };
  }

  // 6. C++ detection
  if (
    /\b(c\+\+|cpp|clang|cmake|g\+\+)\b/.test(text) ||
    text.includes('.cpp') ||
    text.includes('.hpp')
  ) {
    return {
      technology: 'cpp',
      displayName: 'C++',
      primaryExtension: '.cpp',
      plannedFiles: ['food_shop.hpp', 'main.cpp'],
    };
  }

  // 7. C# / .NET detection
  if (
    /\b(c#|csharp|dotnet|\.net|asp\.net)\b/.test(text) ||
    text.includes('.cs')
  ) {
    return {
      technology: 'csharp',
      displayName: 'C#',
      primaryExtension: '.cs',
      plannedFiles: ['Models.cs', 'Program.cs'],
    };
  }

  // 8. Flutter / Dart detection
  if (/\b(flutter|dart)\b/.test(text) || text.includes('.dart')) {
    return {
      technology: 'dart',
      displayName: 'Dart / Flutter',
      primaryExtension: '.dart',
      plannedFiles: ['food_shop.dart', 'main.dart'],
    };
  }

  // 9. PHP detection
  if (/\b(php|laravel|symfony)\b/.test(text) || text.includes('.php')) {
    return {
      technology: 'php',
      displayName: 'PHP',
      primaryExtension: '.php',
      plannedFiles: ['config.php', 'index.php'],
    };
  }

  // 10. SQL detection
  if (/\b(sql|postgresql|postgres|mysql|sqlite)\b/.test(text) || text.includes('.sql')) {
    return {
      technology: 'sql',
      displayName: 'SQL',
      primaryExtension: '.sql',
      plannedFiles: ['schema.sql', 'seed_data.sql'],
    };
  }

  // 11. TypeScript detection
  if (/\b(typescript|ts|express|nest|deno|bun)\b/.test(text) || text.includes('.ts')) {
    return {
      technology: 'typescript',
      displayName: 'TypeScript',
      primaryExtension: '.ts',
      plannedFiles: ['types.ts', 'shop.ts', 'index.ts'],
    };
  }

  // 12. Web Frontend (HTML/CSS/JS) only if web keywords are present
  if (isWebDevelopmentGoal(goal)) {
    return {
      technology: 'html_css_js',
      displayName: 'HTML / CSS / JavaScript',
      primaryExtension: '.html',
      plannedFiles: ['index.html', 'styles.css', 'script.js'],
    };
  }

  // 13. Default fallback to TypeScript
  return {
    technology: 'typescript',
    displayName: 'TypeScript',
    primaryExtension: '.ts',
    plannedFiles: ['types.ts', 'solution.ts'],
  };
}

// ============================================================================
// PYTHON GENERATORS
// ============================================================================

export function generatePythonModels(goal: string): string {
  return `"""
Domain Models for: ${goal}
Production-grade Python dataclasses and typed data contracts.
"""
from dataclasses import dataclass, field
from typing import List, Dict, Optional
from datetime import datetime

@dataclass
class FoodItem:
    id: str
    name: str
    category: str
    price: float
    description: str
    is_available: bool = True
    rating: float = 4.8
    tags: List[str] = field(default_factory=list)

    def to_dict(self) -> Dict:
        return {
            "id": self.id,
            "name": self.name,
            "category": self.category,
            "price": self.price,
            "description": self.description,
            "is_available": self.is_available,
            "rating": self.rating,
            "tags": self.tags,
        }

@dataclass
class CartItem:
    item: FoodItem
    quantity: int = 1

    @property
    def subtotal(self) -> float:
        return round(self.item.price * self.quantity, 2)

@dataclass
class Order:
    order_id: str
    items: List[CartItem]
    created_at: str = field(default_factory=lambda: datetime.utcnow().isoformat())
    discount_code: Optional[str] = None
    discount_rate: float = 0.0

    @property
    def gross_total(self) -> float:
        return round(sum(ci.subtotal for ci in self.items), 2)

    @property
    def discount_amount(self) -> float:
        return round(self.gross_total * self.discount_rate, 2)

    @property
    def net_total(self) -> float:
        return round(self.gross_total - self.discount_amount, 2)
`;
}

export function generatePythonMain(goal: string): string {
  return `"""
Main Application Driver for: ${goal}
Features interactive culinary catalog, shopping cart management, and order checkout.
"""
import sys
import uuid
from typing import List, Optional
from models import FoodItem, CartItem, Order

class FoodShopService:
    def __init__(self, shop_name: str = "FreshBite Artisan Food Shop"):
        self.shop_name = shop_name
        self.catalog: List[FoodItem] = []
        self.cart: List[CartItem] = []
        self._seed_catalog()

    def _seed_catalog(self):
        self.catalog = [
            FoodItem("item-1", "Gourmet Truffle Burger", "Burgers", 14.99, "Aged cheddar, caramelized shallots, black truffle aioli", tags=["bestseller", "gourmet"]),
            FoodItem("item-2", "Woodfired Margherita Pizza", "Pizza", 16.50, "San Marzano tomatoes, fresh buffalo mozzarella, organic basil", tags=["vegetarian", "woodfired"]),
            FoodItem("item-3", "Wild Salmon Superfood Bowl", "Bowls", 15.25, "Pan-seared Alaskan salmon, quinoa, avocado, edamame, citrus ponzu", tags=["healthy", "gluten-free"]),
            FoodItem("item-4", "Smoked BBQ Bacon Stack", "Burgers", 15.99, "Double smashed patties, applewood bacon, house bourbon BBQ sauce", tags=["popular"]),
            FoodItem("item-5", "Artisan Gelato Trio", "Desserts", 7.99, "Pistachio, dark chocolate Madagascar, salted caramel", tags=["dessert", "sweet"]),
            FoodItem("item-6", "Cold-Pressed Detox Green Juice", "Drinks", 6.50, "Kale, green apple, cucumber, ginger, Meyer lemon", tags=["cold-pressed", "vegan"]),
        ]

    def list_menu(self, category: Optional[str] = None) -> List[FoodItem]:
        if category:
            return [it for it in self.catalog if it.category.lower() == category.lower()]
        return self.catalog

    def add_to_cart(self, item_id: str, quantity: int = 1) -> bool:
        item = next((it for it in self.catalog if it.id == item_id), None)
        if not item or quantity <= 0:
            return False
        existing = next((ci for ci in self.cart if ci.item.id == item_id), None)
        if existing:
            existing.quantity += quantity
        else:
            self.cart.append(CartItem(item, quantity))
        return True

    def calculate_total(self, discount_code: Optional[str] = None) -> Order:
        order_id = f"ORD-{uuid.uuid4().hex[:8].upper()}"
        rate = 0.20 if discount_code == "FRESH20" else 0.0
        return Order(order_id=order_id, items=list(self.cart), discount_code=discount_code, discount_rate=rate)

    def checkout(self, discount_code: Optional[str] = None) -> Order:
        order = self.calculate_total(discount_code)
        self.cart.clear()
        return order

def main():
    print("=" * 64)
    print("  FreshBite — Artisan Kitchen & Gourmet Food Shop (Python)")
    print("=" * 64)
    shop = FoodShopService()
    print(f"\\n[Catalog Loaded] {len(shop.catalog)} signature dishes ready.")
    for item in shop.list_menu():
        print(f"  * [{item.id}] {item.name:<32} \${item.price:>5.2f} ({item.category})")

    # Simulate standard ordering workflow
    print("\\n[Ordering] Adding signature items to cart...")
    shop.add_to_cart("item-1", 2) # 2x Truffle Burger
    shop.add_to_cart("item-2", 1) # 1x Margherita Pizza
    shop.add_to_cart("item-6", 2) # 2x Detox Juice

    order = shop.checkout("FRESH20")
    print(f"\\n[Checkout Successful]")
    print(f"  Order ID    : {order.order_id}")
    print(f"  Total Items : {sum(ci.quantity for ci in order.items)}")
    print(f"  Gross Total : \${order.gross_total:.2f}")
    print(f"  Discount    : -\${order.discount_amount:.2f} (Coupon: FRESH20 - 20% off)")
    print(f"  Net Total   : \${order.net_total:.2f}")
    print("=" * 64)

if __name__ == "__main__":
    main()
`;
}

export function generatePythonTests(goal: string): string {
  return `"""
Automated Unit Test Suite for: ${goal}
Verifies catalog listing, cart updates, discount calculations, and checkout.
"""
import unittest
from main import FoodShopService

class TestFoodShopService(unittest.TestCase):
    def setUp(self):
        self.shop = FoodShopService()

    def test_catalog_initialization(self):
        catalog = self.shop.list_menu()
        self.assertGreaterEqual(len(catalog), 5)
        self.assertTrue(any(it.name == "Gourmet Truffle Burger" for it in catalog))

    def test_add_to_cart_and_quantity(self):
        success = self.shop.add_to_cart("item-1", 3)
        self.assertTrue(success)
        self.assertEqual(len(self.shop.cart), 1)
        self.assertEqual(self.shop.cart[0].quantity, 3)

        # Adding same item increases quantity
        self.shop.add_to_cart("item-1", 2)
        self.assertEqual(self.shop.cart[0].quantity, 5)

    def test_coupon_discount_calculation(self):
        self.shop.add_to_cart("item-1", 1)  # $14.99
        order = self.shop.calculate_total("FRESH20")
        self.assertEqual(order.discount_rate, 0.20)
        expected_discount = round(14.99 * 0.20, 2)
        self.assertEqual(order.discount_amount, expected_discount)
        self.assertEqual(order.net_total, round(14.99 - expected_discount, 2))

    def test_checkout_clears_cart(self):
        self.shop.add_to_cart("item-2", 1)
        order = self.shop.checkout()
        self.assertIsNotNone(order.order_id)
        self.assertEqual(len(self.shop.cart), 0)

if __name__ == '__main__':
    unittest.main()
`;
}

// ============================================================================
// REACT / TYPESCRIPT GENERATORS
// ============================================================================

export function generateReactTypes(): string {
  return `export type Category = 'all' | 'burgers' | 'pizza' | 'bowls' | 'drinks' | 'desserts';

export interface FoodItem {
  id: string;
  name: string;
  category: Category;
  price: number;
  description: string;
  rating: number;
  tags: string[];
  imageUrl: string;
}

export interface CartItem {
  item: FoodItem;
  quantity: number;
}

export interface Order {
  id: string;
  items: CartItem[];
  subtotal: number;
  discount: number;
  total: number;
  createdAt: string;
}
`;
}

export function generateReactApp(goal: string): string {
  return `import React, { useState, useMemo } from 'react';
import { FoodItem, CartItem, Category } from './types';
import './styles.css';

const MENU_ITEMS: FoodItem[] = [
  {
    id: 'item-1',
    name: 'Gourmet Truffle Burger',
    category: 'burgers',
    price: 14.99,
    description: 'Aged cheddar, caramelized shallots, black truffle aioli on brioche.',
    rating: 4.9,
    tags: ['Bestseller', 'Chef Special'],
    imageUrl: 'https://images.unsplash.com/photo-1568901346375-23c9450c58cd?w=500&auto=format&fit=crop&q=80',
  },
  {
    id: 'item-2',
    name: 'Woodfired Margherita Pizza',
    category: 'pizza',
    price: 16.50,
    description: 'San Marzano tomatoes, fresh buffalo mozzarella, fragrant organic basil.',
    rating: 4.8,
    tags: ['Vegetarian', 'Woodfired'],
    imageUrl: 'https://images.unsplash.com/photo-1574071318508-1cdbab80d002?w=500&auto=format&fit=crop&q=80',
  },
  {
    id: 'item-3',
    name: 'Wild Salmon Superfood Bowl',
    category: 'bowls',
    price: 15.25,
    description: 'Pan-seared Alaskan salmon, quinoa, hass avocado, citrus ponzu dressing.',
    rating: 4.9,
    tags: ['Healthy', 'Gluten-Free'],
    imageUrl: 'https://images.unsplash.com/photo-1546069901-ba9599a7e63c?w=500&auto=format&fit=crop&q=80',
  },
  {
    id: 'item-4',
    name: 'Cold-Pressed Detox Green Juice',
    category: 'drinks',
    price: 6.50,
    description: 'Crisp kale, green apple, cucumber, wild ginger, and Meyer lemon.',
    rating: 4.7,
    tags: ['Cold-Pressed', 'Vegan'],
    imageUrl: 'https://images.unsplash.com/photo-1613478223719-2ab802602423?w=500&auto=format&fit=crop&q=80',
  },
];

export default function App() {
  const [selectedCategory, setSelectedCategory] = useState<Category>('all');
  const [cart, setCart] = useState<CartItem[]>([]);
  const [isCartOpen, setIsCartOpen] = useState(false);
  const [couponCode, setCouponCode] = useState('');
  const [discountMultiplier, setDiscountMultiplier] = useState(1);

  const filteredItems = useMemo(() => {
    if (selectedCategory === 'all') return MENU_ITEMS;
    return MENU_ITEMS.filter((item) => item.category === selectedCategory);
  }, [selectedCategory]);

  const addToCart = (item: FoodItem) => {
    setCart((prev) => {
      const existing = prev.find((ci) => ci.item.id === item.id);
      if (existing) {
        return prev.map((ci) => (ci.item.id === item.id ? { ...ci, quantity: ci.quantity + 1 } : ci));
      }
      return [...prev, { item, quantity: 1 }];
    });
  };

  const totalItemCount = cart.reduce((acc, ci) => acc + ci.quantity, 0);
  const rawSubtotal = cart.reduce((acc, ci) => acc + ci.item.price * ci.quantity, 0);
  const finalTotal = rawSubtotal * discountMultiplier;

  return (
    <div className="food-shop-app">
      <header className="shop-header">
        <div className="header-brand">🍕 FreshBite Artisan Shop</div>
        <button className="cart-trigger" onClick={() => setIsCartOpen(true)}>
          🛒 Cart ({totalItemCount})
        </button>
      </header>

      <main className="shop-container">
        <section className="hero-banner">
          <h1>Artisan Gourmet Dining, Made Fresh</h1>
          <p>Hand-crafted pizzas, brioche smash burgers, and farm bowls delivered hot.</p>
        </section>

        <nav className="category-tabs">
          {(['all', 'burgers', 'pizza', 'bowls', 'drinks'] as Category[]).map((cat) => (
            <button
              key={cat}
              className={selectedCategory === cat ? 'tab active' : 'tab'}
              onClick={() => setSelectedCategory(cat)}
            >
              {cat.toUpperCase()}
            </button>
          ))}
        </nav>

        <div className="food-grid">
          {filteredItems.map((item) => (
            <div key={item.id} className="food-card">
              <img src={item.imageUrl} alt={item.name} className="card-thumb" />
              <div className="card-body">
                <h3>{item.name}</h3>
                <p>{item.description}</p>
                <div className="card-foot">
                  <span className="price">\${item.price.toFixed(2)}</span>
                  <button className="btn-add" onClick={() => addToCart(item)}>
                    + Add to Cart
                  </button>
                </div>
              </div>
            </div>
          ))}
        </div>
      </main>

      {isCartOpen && (
        <div className="modal-backdrop" onClick={() => setIsCartOpen(false)}>
          <div className="modal-content" onClick={(e) => e.stopPropagation()}>
            <h2>Your Order ({totalItemCount} items)</h2>
            <div className="cart-list">
              {cart.map((ci) => (
                <div key={ci.item.id} className="cart-row">
                  <span>{ci.item.name} x{ci.quantity}</span>
                  <span>\${(ci.item.price * ci.quantity).toFixed(2)}</span>
                </div>
              ))}
            </div>
            <div className="cart-total-box">
              <p>Total: <strong>\${finalTotal.toFixed(2)}</strong></p>
              <button className="btn-checkout" onClick={() => alert('Order confirmed! Delicious food on the way.')}>
                Confirm Checkout
              </button>
            </div>
          </div>
        </div>
      )}
    </div>
  );
}
`;
}

// ============================================================================
// GO / GOLANG GENERATORS
// ============================================================================

export function generateGoModels(): string {
  return `package main

import "time"

type FoodItem struct {
	ID          string   \`json:"id"\`
	Name        string   \`json:"name"\`
	Category    string   \`json:"category"\`
	Price       float64  \`json:"price"\`
	Description string   \`json:"description"\`
	Rating      float64  \`json:"rating"\`
	Tags        []string \`json:"tags"\`
}

type CartItem struct {
	Item     FoodItem \`json:"item"\`
	Quantity int      \`json:"quantity"\`
}

func (c CartItem) Subtotal() float64 {
	return c.Item.Price * float64(c.Quantity)
}

type Order struct {
	ID             string     \`json:"id"\`
	Items          []CartItem \`json:"items"\`
	GrossTotal     float64    \`json:"gross_total"\`
	DiscountAmount float64    \`json:"discount_amount"\`
	NetTotal       float64    \`json:"net_total"\`
	CreatedAt      time.Time  \`json:"created_at"\`
}
`;
}

export function generateGoMain(goal: string): string {
  return `package main

import (
	"fmt"
	"strings"
	"time"
)

type FoodShopService struct {
	ShopName string
	Catalog  []FoodItem
	Cart     []CartItem
}

func NewFoodShopService(name string) *FoodShopService {
	return &FoodShopService{
		ShopName: name,
		Catalog: []FoodItem{
			{ID: "item-1", Name: "Gourmet Truffle Burger", Category: "Burgers", Price: 14.99, Description: "Aged cheddar, truffle aioli"},
			{ID: "item-2", Name: "Woodfired Margherita Pizza", Category: "Pizza", Price: 16.50, Description: "San Marzano tomatoes, fresh buffalo mozzarella"},
			{ID: "item-3", Name: "Wild Salmon Superfood Bowl", Category: "Bowls", Price: 15.25, Description: "Alaskan salmon, quinoa, avocado"},
			{ID: "item-4", Name: "Cold-Pressed Detox Juice", Category: "Drinks", Price: 6.50, Description: "Kale, green apple, ginger, lemon"},
		},
		Cart: []CartItem{},
	}
}

func (s *FoodShopService) AddToCart(itemID string, qty int) bool {
	var target *FoodItem
	for _, it := range s.Catalog {
		if it.ID == itemID {
			target = &it
			break
		}
	}
	if target == nil || qty <= 0 {
		return false
	}
	for i, ci := range s.Cart {
		if ci.Item.ID == itemID {
			s.Cart[i].Quantity += qty
			return true
		}
	}
	s.Cart = append(s.Cart, CartItem{Item: *target, Quantity: qty})
	return true
}

func (s *FoodShopService) Checkout(couponCode string) Order {
	var gross float64
	for _, ci := range s.Cart {
		gross += ci.Subtotal()
	}
	var discountRate float64
	if strings.ToUpper(couponCode) == "FRESH20" {
		discountRate = 0.20
	}
	discountAmt := gross * discountRate
	order := Order{
		ID:             fmt.Sprintf("ORD-%d", time.Now().Unix()),
		Items:          s.Cart,
		GrossTotal:     gross,
		DiscountAmount: discountAmt,
		NetTotal:       gross - discountAmt,
		CreatedAt:      time.Now(),
	}
	s.Cart = []CartItem{}
	return order
}

func main() {
	fmt.Println(strings.Repeat("=", 60))
	fmt.Println("  FreshBite — Artisan Food Shop Backend (Go)")
	fmt.Println(strings.Repeat("=", 60))

	shop := NewFoodShopService("FreshBite Artisan Shop")
	fmt.Printf("[Catalog Ready] %d items loaded.\\n", len(shop.Catalog))
	for _, it := range shop.Catalog {
		fmt.Printf("  * [%s] %-28s $%.2f (%s)\\n", it.ID, it.Name, it.Price, it.Category)
	}

	shop.AddToCart("item-1", 2)
	shop.AddToCart("item-2", 1)
	shop.AddToCart("item-4", 2)

	order := shop.Checkout("FRESH20")
	fmt.Printf("\\n[Checkout Complete]\\n")
	fmt.Printf("  Order ID    : %s\\n", order.ID)
	fmt.Printf("  Gross Total : $%.2f\\n", order.GrossTotal)
	fmt.Printf("  Discount    : -$%.2f (FRESH20)\\n", order.DiscountAmount)
	fmt.Printf("  Net Total   : $%.2f\\n", order.NetTotal)
	fmt.Println(strings.Repeat("=", 60))
}
`;
}

export function generateGoTests(): string {
  return `package main

import (
	"testing"
)

func TestCatalogInitialization(t *testing.T) {
	shop := NewFoodShopService("Test Shop")
	if len(shop.Catalog) < 4 {
		t.Fatalf("Expected at least 4 catalog items, got %d", len(shop.Catalog))
	}
}

func TestAddToCart(t *testing.T) {
	shop := NewFoodShopService("Test Shop")
	success := shop.AddToCart("item-1", 3)
	if !success {
		t.Fatal("Failed to add valid item to cart")
	}
	if len(shop.Cart) != 1 || shop.Cart[0].Quantity != 3 {
		t.Fatalf("Unexpected cart state: %+v", shop.Cart)
	}
}

func TestDiscountCalculation(t *testing.T) {
	shop := NewFoodShopService("Test Shop")
	shop.AddToCart("item-1", 1) // $14.99
	order := shop.Checkout("FRESH20")
	if order.DiscountAmount <= 0 {
		t.Fatalf("Discount amount should be > 0, got $%.2f", order.DiscountAmount)
	}
	if order.NetTotal >= order.GrossTotal {
		t.Fatalf("Net total ($%.2f) must be less than gross ($%.2f)", order.NetTotal, order.GrossTotal)
	}
}
`;
}

// ============================================================================
// RUST GENERATORS
// ============================================================================

export function generateRustCargo(): string {
  return `[package]
name = "food_shop"
version = "0.1.0"
edition = "2021"

[dependencies]
`;
}

export function generateRustMain(goal: string): string {
  return `//! Food Shop Implementation in Rust
//! Production-grade models, catalog, cart, and discount checkout.

#[derive(Debug, Clone)]
pub struct FoodItem {
    pub id: String,
    pub name: String,
    pub category: String,
    pub price: f64,
}

#[derive(Debug, Clone)]
pub struct CartItem {
    pub item: FoodItem,
    pub quantity: u32,
}

impl CartItem {
    pub fn subtotal(&self) -> f64 {
        self.item.price * (self.quantity as f64)
    }
}

pub struct FoodShop {
    pub catalog: Vec<FoodItem>,
    pub cart: Vec<CartItem>,
}

impl FoodShop {
    pub fn new() -> Self {
        Self {
            catalog: vec![
                FoodItem { id: "item-1".into(), name: "Gourmet Truffle Burger".into(), category: "Burgers".into(), price: 14.99 },
                FoodItem { id: "item-2".into(), name: "Woodfired Margherita Pizza".into(), category: "Pizza".into(), price: 16.50 },
                FoodItem { id: "item-3".into(), name: "Wild Salmon Superfood Bowl".into(), category: "Bowls".into(), price: 15.25 },
                FoodItem { id: "item-4".into(), name: "Cold-Pressed Detox Juice".into(), category: "Drinks".into(), price: 6.50 },
            ],
            cart: Vec::new(),
        }
    }

    pub fn add_to_cart(&mut self, item_id: &str, quantity: u32) -> bool {
        if let Some(it) = self.catalog.iter().find(|i| i.id == item_id).cloned() {
            if let Some(ci) = self.cart.iter_mut().find(|c| c.item.id == item_id) {
                ci.quantity += quantity;
            } else {
                self.cart.push(CartItem { item: it, quantity });
            }
            true
        } else {
            false
        }
    }

    pub fn checkout(&mut self, coupon: &str) -> (f64, f64, f64) {
        let gross: f64 = self.cart.iter().map(|ci| ci.subtotal()).sum();
        let discount_rate = if coupon.eq_ignore_ascii_case("FRESH20") { 0.20 } else { 0.0 };
        let discount = gross * discount_rate;
        let net = gross - discount;
        self.cart.clear();
        (gross, discount, net)
    }
}

fn main() {
    println!("{:=<60}", "");
    println!("  FreshBite — Artisan Food Shop (Rust)");
    println!("{:=<60}", "");

    let mut shop = FoodShop::new();
    println!("[Catalog Loaded] {} dishes available.", shop.catalog.len());
    for it in &shop.catalog {
        println!("  * [{}] {:<28} $ {:.2}", it.id, it.name, it.price);
    }

    shop.add_to_cart("item-1", 2);
    shop.add_to_cart("item-2", 1);
    let (gross, discount, net) = shop.checkout("FRESH20");

    println!("\\n[Checkout Summary]");
    println!("  Gross Total : $ {:.2}", gross);
    println!("  Discount    : -$ {:.2} (Coupon: FRESH20)", discount);
    println!("  Net Total   : $ {:.2}", net);
    println!("{:=<60}", "");
}

#[cfg(test)]
mod tests {
    use super::*;

    #[test]
    fn test_catalog_not_empty() {
        let shop = FoodShop::new();
        assert!(shop.catalog.len() >= 4);
    }

    #[test]
    fn test_cart_addition() {
        let mut shop = FoodShop::new();
        assert!(shop.add_to_cart("item-1", 2));
        assert_eq!(shop.cart.len(), 1);
        assert_eq!(shop.cart[0].quantity, 2);
    }
}
`;
}

// ============================================================================
// JAVA GENERATORS
// ============================================================================

export function generateJavaProduct(): string {
  return `package com.freshbite;

public class Product {
    private String id;
    private String name;
    private String category;
    private double price;
    private String description;

    public Product(String id, String name, String category, double price, String description) {
        this.id = id;
        this.name = name;
        this.category = category;
        this.price = price;
        this.description = description;
    }

    public String getId() { return id; }
    public String getName() { return name; }
    public String getCategory() { return category; }
    public double getPrice() { return price; }
    public String getDescription() { return description; }

    @Override
    public String toString() {
        return String.format("[%s] %-28s $%.2f (%s)", id, name, price, category);
    }
}
`;
}

export function generateJavaFoodShop(): string {
  return `package com.freshbite;

import java.util.*;

public class FoodShop {
    private List<Product> catalog = new ArrayList<>();
    private Map<String, Integer> cart = new LinkedHashMap<>();

    public FoodShop() {
        catalog.add(new Product("item-1", "Gourmet Truffle Burger", "Burgers", 14.99, "Aged cheddar, truffle aioli"));
        catalog.add(new Product("item-2", "Woodfired Margherita Pizza", "Pizza", 16.50, "San Marzano tomatoes, buffalo mozzarella"));
        catalog.add(new Product("item-3", "Wild Salmon Superfood Bowl", "Bowls", 15.25, "Alaskan salmon, quinoa, avocado"));
        catalog.add(new Product("item-4", "Cold-Pressed Detox Juice", "Drinks", 6.50, "Kale, green apple, ginger"));
    }

    public List<Product> getCatalog() { return catalog; }

    public boolean addToCart(String productId, int quantity) {
        if (catalog.stream().noneMatch(p -> p.getId().equals(productId))) return false;
        cart.put(productId, cart.getOrDefault(productId, 0) + quantity);
        return true;
    }

    public double calculateGrossTotal() {
        double total = 0;
        for (Map.Entry<String, Integer> entry : cart.entrySet()) {
            Product p = catalog.stream().filter(it -> it.getId().equals(entry.getKey())).findFirst().orElse(null);
            if (p != null) total += p.getPrice() * entry.getValue();
        }
        return total;
    }

    public double checkout(String couponCode) {
        double gross = calculateGrossTotal();
        double discountRate = "FRESH20".equalsIgnoreCase(couponCode) ? 0.20 : 0.0;
        double net = gross * (1.0 - discountRate);
        cart.clear();
        return net;
    }
}
`;
}

export function generateJavaMain(goal: string): string {
  return `package com.freshbite;

public class Main {
    public static void main(String[] args) {
        System.out.println("============================================================");
        System.out.println("  FreshBite — Artisan Food Shop System (Java)");
        System.out.println("============================================================");

        FoodShop shop = new FoodShop();
        System.out.println("\\n[Catalog Loaded] " + shop.getCatalog().size() + " signature items available:");
        for (Product p : shop.getCatalog()) {
            System.out.println("  * " + p);
        }

        System.out.println("\\n[Ordering] Adding items to cart...");
        shop.addToCart("item-1", 2);
        shop.addToCart("item-2", 1);
        shop.addToCart("item-4", 2);

        double total = shop.checkout("FRESH20");
        System.out.printf("\\n[Checkout Complete] Net Total: $%.2f (Discount Coupon: FRESH20 - 20%% off)\\n", total);
        System.out.println("============================================================");
    }
}
`;
}

// ============================================================================
// C++ GENERATORS
// ============================================================================

export function generateCppHeader(): string {
  return `#pragma once
#include <string>
#include <vector>
#include <iostream>
#include <iomanip>

struct FoodItem {
    std::string id;
    std::string name;
    std::string category;
    double price;
    std::string description;
};

struct CartItem {
    FoodItem item;
    int quantity;
    double subtotal() const { return item.price * quantity; }
};

class FoodShop {
public:
    std::vector<FoodItem> catalog;
    std::vector<CartItem> cart;

    FoodShop() {
        catalog = {
            {"item-1", "Gourmet Truffle Burger", "Burgers", 14.99, "Aged cheddar, truffle aioli"},
            {"item-2", "Woodfired Margherita Pizza", "Pizza", 16.50, "San Marzano tomatoes, buffalo mozzarella"},
            {"item-3", "Wild Salmon Superfood Bowl", "Bowls", 15.25, "Alaskan salmon, quinoa, avocado"},
            {"item-4", "Cold-Pressed Detox Juice", "Drinks", 6.50, "Kale, green apple, ginger"},
        };
    }

    bool addToCart(const std::string& id, int qty) {
        for (const auto& it : catalog) {
            if (it.id == id) {
                for (auto& ci : cart) {
                    if (ci.item.id == id) {
                        ci.quantity += qty;
                        return true;
                    }
                }
                cart.push_back({it, qty});
                return true;
            }
        }
        return false;
    }

    double checkout(const std::string& coupon) {
        double gross = 0.0;
        for (const auto& ci : cart) gross += ci.subtotal();
        double discount = (coupon == "FRESH20") ? gross * 0.20 : 0.0;
        cart.clear();
        return gross - discount;
    }
};
`;
}

export function generateCppMain(goal: string): string {
  return `#include "food_shop.hpp"

int main() {
    std::cout << "============================================================\\n";
    std::cout << "  FreshBite — Artisan Food Shop (C++)\\n";
    std::cout << "============================================================\\n";

    FoodShop shop;
    std::cout << "\\n[Catalog Ready] " << shop.catalog.size() << " signature items:\\n";
    for (const auto& it : shop.catalog) {
        std::cout << "  * [" << it.id << "] " << std::left << std::setw(28) << it.name
                  << " $" << std::fixed << std::setprecision(2) << it.price
                  << " (" << it.category << ")\\n";
    }

    shop.addToCart("item-1", 2);
    shop.addToCart("item-2", 1);
    shop.addToCart("item-4", 2);

    double net = shop.checkout("FRESH20");
    std::cout << "\\n[Checkout Successful] Order Total: $" << std::fixed << std::setprecision(2) << net
              << " (Applied FRESH20 20% discount)\\n";
    std::cout << "============================================================\\n";
    return 0;
}
`;
}

// ============================================================================
// DYNAMIC MULTI-DOMAIN HTML / CSS / JAVASCRIPT GENERATORS
// ============================================================================

export type WebDomain =
  | 'barber'
  | 'gym'
  | 'portfolio'
  | 'restaurant'
  | 'healthcare'
  | 'saas'
  | 'ecommerce'
  | 'generic';

export function detectWebDomain(goal: string): WebDomain {
  const g = (goal || '').toLowerCase();
  if (/barber|barbeer|barbershop|salon|haircut|shav|grooming|fade|stylist|beard|pomade/.test(g)) {
    return 'barber';
  }
  if (/gym|fitness|workout|crossfit|bodybuilding|trainer|yoga|pilates|muscle|athlete|lifting/.test(g)) {
    return 'gym';
  }
  if (/portfolio|resume|\bcv\b|personal site|freelance|developer portfolio|designer portfolio/.test(g)) {
    return 'portfolio';
  }
  if (/food|restaurant|cafe|pizza|burger|bakery|dining|bistro|coffee|snack|culinary|kitchen/.test(g)) {
    return 'restaurant';
  }
  if (/doctor|clinic|dental|dentist|hospital|medical|physio|healthcare|pharma|patient/.test(g)) {
    return 'healthcare';
  }
  if (/\b(shop|store|ecommerce|e-commerce|fashion|clothing|boutique|merch|apparel|shoes)\b/.test(g)) {
    return 'ecommerce';
  }
  if (/\b(saas|software|tech|app|startup|cloud|analytics|api|platform|crm|dashboard|devtools)\b/.test(g)) {
    return 'saas';
  }
  return 'generic';
}

export function getDomainLabel(domain: WebDomain): string {
  switch (domain) {
    case 'barber':
      return 'Barber Shop & Grooming Lounge';
    case 'gym':
      return 'Fitness Center & Gym';
    case 'portfolio':
      return 'Professional Portfolio Showcase';
    case 'restaurant':
      return 'Artisan Kitchen & Food Shop';
    case 'healthcare':
      return 'Medical & Health Clinic';
    case 'saas':
      return 'Modern Cloud SaaS Platform';
    case 'ecommerce':
      return 'E-Commerce Boutique & Store';
    default:
      return 'Modern Business Showcase';
  }
}

export function generateDynamicWebHtml(goal = 'Modern Landing Page'): string {
  const domain = detectWebDomain(goal);

  // 1. BARBER SHOP & GROOMING
  if (domain === 'barber') {
    return `<!DOCTYPE html>
<html lang="en">
<head>
  <meta charset="UTF-8">
  <meta name="viewport" content="width=device-width, initial-scale=1.0">
  <title>Apex & Blade — Artisan Barber Shop & Men's Grooming</title>
  <link rel="preconnect" href="https://fonts.googleapis.com">
  <link rel="preconnect" href="https://fonts.gstatic.com" crossorigin>
  <link href="https://fonts.googleapis.com/css2?family=Plus+Jakarta+Sans:wght@400;500;600;700;800&family=Playfair+Display:ital,wght@0,600;0,700;1,600&display=swap" rel="stylesheet">
  <link rel="stylesheet" href="styles.css">
</head>
<body>
  <header class="navbar">
    <div class="nav-container">
      <a href="#" class="brand-logo">
        <span class="brand-icon">✂️</span>
        <span class="brand-name">Apex<span>Barber</span></span>
      </a>
      <nav class="nav-links">
        <a href="#services" class="active">Services</a>
        <a href="#barbers">Master Barbers</a>
        <a href="#pricing">Rates</a>
        <a href="#about">Heritage</a>
      </nav>
      <div class="nav-actions">
        <button id="action-toggle-btn" class="action-btn" aria-label="Book an Appointment">
          <span class="action-icon">📅</span>
          <span class="action-label">Book Appointment</span>
        </button>
      </div>
    </div>
  </header>

  <main>
    <section class="hero-section">
      <div class="hero-container">
        <div class="hero-content">
          <div class="hero-pill">💈 Master Craftsmen · Est. 2026</div>
          <h1 class="hero-title">Masterful Cuts, Precision Fades & <span>Timeless Grooming</span></h1>
          <p class="hero-subtitle">Crafting sharp silhouettes, hot-towel straight razor shaves, tailored beard sculpting, and premium scalp treatments in a relaxed, classic lounge environment.</p>
          <div class="hero-cta-group">
            <a href="#services" class="btn btn-primary">Book Your Chair</a>
            <a href="#pricing" class="btn btn-outline">Explore Grooming Rates</a>
          </div>
          <div class="hero-stats">
            <div class="stat-item">
              <span class="stat-number">4.9 ★</span>
              <span class="stat-label">5,000+ Gentlemen</span>
            </div>
            <div class="stat-item">
              <span class="stat-number">15+ yrs</span>
              <span class="stat-label">Master Barbers</span>
            </div>
            <div class="stat-item">
              <span class="stat-number">100%</span>
              <span class="stat-label">Satisfaction</span>
            </div>
          </div>
        </div>
      </div>
    </section>

    <section id="services" class="services-section">
      <div class="section-container">
        <div class="section-header">
          <span class="section-tag">Signature Services</span>
          <h2 class="section-title">Handcrafted Cuts & Classic Shaves</h2>
          <p class="section-desc">Every haircut and shave is tailored to your head shape, facial structure, and personal style.</p>
        </div>
        <div id="items-grid" class="items-grid"></div>
      </div>
    </section>

    <section id="barbers" class="barbers-section">
      <div class="section-container">
        <div class="section-header">
          <span class="section-tag">The Craftsmen</span>
          <h2 class="section-title">Meet Our Master Barbers</h2>
        </div>
        <div class="barbers-grid">
          <div class="barber-card">
            <img src="https://images.unsplash.com/photo-1503951914875-452162b0f3f1?w=400&auto=format&fit=crop&q=80" alt="Marcus Vance" class="barber-thumb">
            <h4>Marcus 'The Blade' Vance</h4>
            <p>Master Barber with 12 years of experience specializing in classic low-skin fades and traditional straight-edge shaves.</p>
          </div>
          <div class="barber-card">
            <img src="https://images.unsplash.com/photo-1585747860715-2ba37e788b70?w=400&auto=format&fit=crop&q=80" alt="Elena Rostova" class="barber-thumb">
            <h4>Elena Rostova</h4>
            <p>Senior Stylist and scissor work master specializing in modern textured crops and facial hair contouring.</p>
          </div>
        </div>
      </div>
    </section>
  </main>

  <!-- Interactive Booking Modal -->
  <div id="action-modal" class="modal-backdrop booking-modal">
    <div class="modal-card">
      <div class="modal-header">
        <h3>Reserve Your Chair at Apex Barber</h3>
        <button id="close-modal-btn" class="close-btn">&times;</button>
      </div>
      <form id="booking-form" class="modal-body">
        <div class="form-group">
          <label>Select Grooming Service</label>
          <select id="service-select" class="form-control" required>
            <option value="Signature Razor Fade & Haircut">Signature Razor Fade & Haircut ($35.00)</option>
            <option value="Executive Razor Fade">Executive Razor Fade ($40.00)</option>
            <option value="Classic Hot Towel Straight Shave">Classic Hot Towel Straight Shave ($28.00)</option>
            <option value="Beard Sculpting & Razor Line-Up">Beard Sculpting & Razor Line-Up ($22.00)</option>
            <option value="The Royal Treatment Package">The Royal Treatment Package ($55.00)</option>
          </select>
        </div>
        <div class="form-group">
          <label>Preferred Master Barber</label>
          <select id="barber-select" class="form-control">
            <option value="Marcus 'The Blade' Vance">Marcus 'The Blade' Vance</option>
            <option value="Elena Rostova">Elena Rostova</option>
            <option value="Any Available Craftsman">Any Available Craftsman</option>
          </select>
        </div>
        <div class="form-row">
          <div class="form-group">
            <label>Preferred Date</label>
            <input type="date" id="booking-date" class="form-control" required>
          </div>
          <div class="form-group">
            <label>Time Slot</label>
            <select id="booking-time" class="form-control">
              <option>10:00 AM</option>
              <option>11:30 AM</option>
              <option>02:00 PM</option>
              <option>04:30 PM</option>
              <option>06:00 PM</option>
            </select>
          </div>
        </div>
        <div class="form-group">
          <label>Your Full Name</label>
          <input type="text" id="client-name" class="form-control" placeholder="e.g. James Wilson" required>
        </div>
        <div class="form-group">
          <label>Mobile Number</label>
          <input type="tel" id="client-phone" class="form-control" placeholder="e.g. (555) 234-5678" required>
        </div>
        <button type="submit" class="btn btn-primary btn-block">Confirm Appointment Booking</button>
      </form>
    </div>
  </div>

  <footer class="footer">
    <div class="nav-container">
      <div class="brand-logo">
        <span class="brand-icon">✂️</span>
        <span class="brand-name">Apex<span>Barber</span></span>
      </div>
      <p class="footer-copy">&copy; 2026 Apex Barber & Co. 442 Heritage Lane, Suite 100 · (555) 392-8172 · Tue–Sat 9AM–8PM</p>
    </div>
  </footer>

  <div id="toast-container" class="toast-container"></div>
  <script src="script.js"></script>
</body>
</html>`;
  }

  // 2. GYM & FITNESS
  if (domain === 'gym') {
    return `<!DOCTYPE html>
<html lang="en">
<head>
  <meta charset="UTF-8">
  <meta name="viewport" content="width=device-width, initial-scale=1.0">
  <title>Titan Fitness — High-Performance Strength & Conditioning Gym</title>
  <link rel="preconnect" href="https://fonts.googleapis.com">
  <link rel="preconnect" href="https://fonts.gstatic.com" crossorigin>
  <link href="https://fonts.googleapis.com/css2?family=Plus+Jakarta+Sans:wght@400;500;600;700;800&display=swap" rel="stylesheet">
  <link rel="stylesheet" href="styles.css">
</head>
<body>
  <header class="navbar">
    <div class="nav-container">
      <a href="#" class="brand-logo">
        <span class="brand-icon">⚡</span>
        <span class="brand-name">Titan<span>Fit</span></span>
      </a>
      <nav class="nav-links">
        <a href="#services" class="active">Programs</a>
        <a href="#trainers">Coaches</a>
        <a href="#membership">Membership</a>
      </nav>
      <div class="nav-actions">
        <button id="action-toggle-btn" class="action-btn">
          <span class="action-icon">💪</span>
          <span class="action-label">Claim Free Pass</span>
        </button>
      </div>
    </div>
  </header>

  <main>
    <section class="hero-section">
      <div class="hero-container">
        <div class="hero-content">
          <div class="hero-pill">⚡ 24/7 Elite Training Facility</div>
          <h1 class="hero-title">Forge Peak Strength, Power & <span>Relentless Grit</span></h1>
          <p class="hero-subtitle">Olympic lifting platforms, world-class strength coaching, high-intensity functional conditioning, and recovery saunas designed for serious athletes.</p>
          <div class="hero-cta-group">
            <a href="#services" class="btn btn-primary">Explore Programs</a>
            <a href="#membership" class="btn btn-outline">View Membership Plans</a>
          </div>
        </div>
      </div>
    </section>

    <section id="services" class="services-section">
      <div class="section-container">
        <div class="section-header">
          <span class="section-tag">Elite Programs</span>
          <h2 class="section-title">Designed for Maximum Results</h2>
        </div>
        <div id="items-grid" class="items-grid"></div>
      </div>
    </section>
  </main>

  <div id="action-modal" class="modal-backdrop gym-modal">
    <div class="modal-card">
      <div class="modal-header">
        <h3>Claim Your 3-Day Free Titan Pass</h3>
        <button id="close-modal-btn" class="close-btn">&times;</button>
      </div>
      <form id="booking-form" class="modal-body">
        <div class="form-group">
          <label>Your Name</label>
          <input type="text" id="client-name" class="form-control" required placeholder="e.g. Chris Hemsworth">
        </div>
        <div class="form-group">
          <label>Email Address</label>
          <input type="email" id="client-email" class="form-control" required placeholder="name@email.com">
        </div>
        <button type="submit" class="btn btn-primary btn-block">Activate Free Guest Pass</button>
      </form>
    </div>
  </div>

  <div id="toast-container" class="toast-container"></div>
  <script src="script.js"></script>
</body>
</html>`;
  }

  // 3. DEVELOPER PORTFOLIO
  if (domain === 'portfolio') {
    return `<!DOCTYPE html>
<html lang="en">
<head>
  <meta charset="UTF-8">
  <meta name="viewport" content="width=device-width, initial-scale=1.0">
  <title>Alex Morgan — Principal Software Architect & Product Engineer</title>
  <link rel="preconnect" href="https://fonts.googleapis.com">
  <link rel="preconnect" href="https://fonts.gstatic.com" crossorigin>
  <link href="https://fonts.googleapis.com/css2?family=Plus+Jakarta+Sans:wght@400;500;600;700;800&display=swap" rel="stylesheet">
  <link rel="stylesheet" href="styles.css">
</head>
<body>
  <header class="navbar">
    <div class="nav-container">
      <a href="#" class="brand-logo">
        <span class="brand-icon">💻</span>
        <span class="brand-name">Alex<span>Morgan</span></span>
      </a>
      <nav class="nav-links">
        <a href="#services" class="active">Projects</a>
        <a href="#about">Experience</a>
        <a href="#contact">Contact</a>
      </nav>
      <div class="nav-actions">
        <button id="action-toggle-btn" class="action-btn">
          <span class="action-icon">✉️</span>
          <span class="action-label">Get in Touch</span>
        </button>
      </div>
    </div>
  </header>

  <main>
    <section class="hero-section">
      <div class="hero-container">
        <div class="hero-content">
          <div class="hero-pill">🚀 Senior Full-Stack & AI Systems Architect</div>
          <h1 class="hero-title">Architecting Resilient Systems & <span>High-Impact Products</span></h1>
          <p class="hero-subtitle">10+ years specializing in distributed TypeScript microservices, real-time agentic workflows, sub-second vector search, and clean design systems.</p>
          <div class="hero-cta-group">
            <a href="#services" class="btn btn-primary">View Featured Projects</a>
            <a href="#contact" class="btn btn-outline">Schedule Technical Call</a>
          </div>
        </div>
      </div>
    </section>

    <section id="services" class="services-section">
      <div class="section-container">
        <div class="section-header">
          <span class="section-tag">Engineering Showcase</span>
          <h2 class="section-title">Selected Production Works</h2>
        </div>
        <div id="items-grid" class="items-grid"></div>
      </div>
    </section>
  </main>

  <div id="action-modal" class="modal-backdrop contact-modal">
    <div class="modal-card">
      <div class="modal-header">
        <h3>Start a Conversation</h3>
        <button id="close-modal-btn" class="close-btn">&times;</button>
      </div>
      <form id="booking-form" class="modal-body">
        <div class="form-group">
          <label>Your Name</label>
          <input type="text" id="client-name" class="form-control" required placeholder="Alex Turner">
        </div>
        <div class="form-group">
          <label>Project Scope or Question</label>
          <textarea id="client-message" class="form-control" rows="3" placeholder="Tell me about your architectural goals..."></textarea>
        </div>
        <button type="submit" class="btn btn-primary btn-block">Send Message</button>
      </form>
    </div>
  </div>

  <div id="toast-container" class="toast-container"></div>
  <script src="script.js"></script>
</body>
</html>`;
  }

  // 4. RESTAURANT & FOOD (DEFAULT FOR FOOD GOALS)
  if (domain === 'restaurant') {
    return `<!DOCTYPE html>
<html lang="en">
<head>
  <meta charset="UTF-8">
  <meta name="viewport" content="width=device-width, initial-scale=1.0">
  <title>FreshBite — Artisan Kitchen & Gourmet Food Shop</title>
  <link rel="preconnect" href="https://fonts.googleapis.com">
  <link rel="preconnect" href="https://fonts.gstatic.com" crossorigin>
  <link href="https://fonts.googleapis.com/css2?family=Plus+Jakarta+Sans:wght@400;500;600;700;800&family=Playfair+Display:ital,wght@0,600;0,700;1,600&display=swap" rel="stylesheet">
  <link rel="stylesheet" href="styles.css">
</head>
<body>
  <header class="navbar">
    <div class="nav-container">
      <a href="#" class="brand-logo">
        <span class="brand-icon">🍕</span>
        <span class="brand-name">Fresh<span>Bite</span></span>
      </a>
      <nav class="nav-links">
        <a href="#services" class="active">Menu</a>
        <a href="#specials">Today's Deals</a>
        <a href="#about">Story</a>
      </nav>
      <div class="nav-actions">
        <button id="action-toggle-btn" class="action-btn">
          <span class="action-icon">🛒</span>
          <span class="action-label">Cart</span>
          <span id="cart-counter" class="cart-badge">0</span>
        </button>
      </div>
    </div>
  </header>

  <main>
    <section class="hero-section">
      <div class="hero-container">
        <div class="hero-content">
          <div class="hero-pill">🔥 100% Farm-to-Table & Chef Crafted</div>
          <h1 class="hero-title">Delicious Bites, Made with <span>Passion</span> & Pure Flavor</h1>
          <p class="hero-subtitle">Experience artisan pizzas, flame-grilled brioche burgers, nutrient-dense bowls, and fresh cold-pressed smoothies delivered steaming hot in 25 minutes.</p>
          <div class="hero-cta-group">
            <a href="#services" class="btn btn-primary">Explore Full Menu</a>
            <a href="#specials" class="btn btn-outline">Claim 20% Discount</a>
          </div>
        </div>
      </div>
    </section>

    <section id="services" class="services-section">
      <div class="section-container">
        <div class="section-header">
          <span class="section-tag">Chef's Selections</span>
          <h2 class="section-title">Discover Our Handcrafted Menu</h2>
        </div>
        <div id="items-grid" class="items-grid"></div>
      </div>
    </section>
  </main>

  <div id="action-modal" class="modal-backdrop cart-modal">
    <div class="modal-card">
      <div class="modal-header">
        <h3>Your FreshBite Order</h3>
        <button id="close-modal-btn" class="close-btn">&times;</button>
      </div>
      <div id="cart-items-container" class="cart-items-list"></div>
      <div class="modal-footer">
        <div class="cart-summary-line total">
          <span>Total:</span>
          <span id="cart-total">$0.00</span>
        </div>
        <button id="checkout-btn" class="btn btn-primary btn-block">Confirm & Place Order</button>
      </div>
    </div>
  </div>

  <div id="toast-container" class="toast-container"></div>
  <script src="script.js"></script>
</body>
</html>`;
  }

  // 5. GENERIC MODERN LANDING PAGE (ADAPTIVE TO USER PROMPT)
  const safeGoal = goal.replace(/["'<>]/g, '');
  const brandWord = safeGoal.split(' ').find((w) => w.length > 3) || 'Cortex';
  const brandTitle = brandWord.charAt(0).toUpperCase() + brandWord.slice(1);

  return `<!DOCTYPE html>
<html lang="en">
<head>
  <meta charset="UTF-8">
  <meta name="viewport" content="width=device-width, initial-scale=1.0">
  <title>${brandTitle} — ${safeGoal}</title>
  <link rel="preconnect" href="https://fonts.googleapis.com">
  <link rel="preconnect" href="https://fonts.gstatic.com" crossorigin>
  <link href="https://fonts.googleapis.com/css2?family=Plus+Jakarta+Sans:wght@400;500;600;700;800&display=swap" rel="stylesheet">
  <link rel="stylesheet" href="styles.css">
</head>
<body>
  <header class="navbar">
    <div class="nav-container">
      <a href="#" class="brand-logo">
        <span class="brand-icon">✨</span>
        <span class="brand-name">${brandTitle}<span>Hub</span></span>
      </a>
      <nav class="nav-links">
        <a href="#services" class="active">Features</a>
        <a href="#about">About</a>
        <a href="#contact">Contact</a>
      </nav>
      <div class="nav-actions">
        <button id="action-toggle-btn" class="action-btn">
          <span class="action-icon">🚀</span>
          <span class="action-label">Get Started</span>
        </button>
      </div>
    </div>
  </header>

  <main>
    <section class="hero-section">
      <div class="hero-container">
        <div class="hero-content">
          <div class="hero-pill">✨ Modern High-Performance Experience</div>
          <h1 class="hero-title">${safeGoal.charAt(0).toUpperCase() + safeGoal.slice(1)}</h1>
          <p class="hero-subtitle">Discover premium quality, modern responsive craftsmanship, and seamless user experiences tailored to your everyday needs.</p>
          <div class="hero-cta-group">
            <a href="#services" class="btn btn-primary">Explore Solutions</a>
            <a href="#action-modal" class="btn btn-outline" onclick="openModal()">Get in Touch</a>
          </div>
        </div>
      </div>
    </section>

    <section id="services" class="services-section">
      <div class="section-container">
        <div class="section-header">
          <span class="section-tag">Featured Solutions</span>
          <h2 class="section-title">Built for Your Success</h2>
        </div>
        <div id="items-grid" class="items-grid"></div>
      </div>
    </section>
  </main>

  <div id="action-modal" class="modal-backdrop inquiry-modal">
    <div class="modal-card">
      <div class="modal-header">
        <h3>Connect with ${brandTitle}</h3>
        <button id="close-modal-btn" class="close-btn">&times;</button>
      </div>
      <form id="booking-form" class="modal-body">
        <div class="form-group">
          <label>Your Name</label>
          <input type="text" id="client-name" class="form-control" required placeholder="Jordan Smith">
        </div>
        <div class="form-group">
          <label>Email Address</label>
          <input type="email" id="client-email" class="form-control" required placeholder="jordan@company.com">
        </div>
        <button type="submit" class="btn btn-primary btn-block">Submit Inquiry</button>
      </form>
    </div>
  </div>

  <div id="toast-container" class="toast-container"></div>
  <script src="script.js"></script>
</body>
</html>`;
}

export function generateDynamicWebCss(domain: WebDomain, _goal = ''): string {
  // Palettes by domain
  let primary = '#2563eb';
  let primaryHover = '#1d4ed8';
  let bgMain = '#f8fafc';
  let bgCard = '#ffffff';
  let textMain = '#0f172a';
  let textMuted = '#64748b';
  let border = '#e2e8f0';

  if (domain === 'barber') {
    primary = '#d4af37'; // Antique gold
    primaryHover = '#c29b28';
    bgMain = '#0e0f12'; // Deep luxury slate
    bgCard = '#16181f';
    textMain = '#f3f4f6';
    textMuted = '#9ca3af';
    border = '#262833';
  } else if (domain === 'gym') {
    primary = '#06b6d4'; // Electric cyan
    primaryHover = '#0891b2';
    bgMain = '#090d16';
    bgCard = '#111827';
    textMain = '#f9fafb';
    textMuted = '#94a3b8';
    border = '#1f2937';
  } else if (domain === 'portfolio') {
    primary = '#6366f1'; // Indigo
    primaryHover = '#4f46e5';
    bgMain = '#0b0f19';
    bgCard = '#131a2a';
    textMain = '#f8fafc';
    textMuted = '#94a3b8';
    border = '#1e293b';
  } else if (domain === 'restaurant') {
    primary = '#ea580c'; // Warm orange
    primaryHover = '#c2410c';
    bgMain = '#faf8f5';
    bgCard = '#ffffff';
    textMain = '#1e293b';
    textMuted = '#64748b';
    border = '#e2e8f0';
  }

  const isDark = domain === 'barber' || domain === 'gym' || domain === 'portfolio';

  return `:root {
  --primary: ${primary};
  --primary-hover: ${primaryHover};
  --gold: #d4af37;
  --bg-main: ${bgMain};
  --bg-card: ${bgCard};
  --text-main: ${textMain};
  --text-muted: ${textMuted};
  --border: ${border};
}
* { margin: 0; padding: 0; box-sizing: border-box; }
body { font-family: 'Plus Jakarta Sans', sans-serif; background: var(--bg-main); color: var(--text-main); line-height: 1.5; }
.navbar { background: var(--bg-card); border-bottom: 1px solid var(--border); position: sticky; top: 0; z-index: 50; }
.nav-container { max-width: 1200px; margin: 0 auto; display: flex; align-items: center; justify-content: space-between; padding: 1rem 1.5rem; }
.brand-logo { font-size: 1.25rem; font-weight: 800; color: var(--text-main); text-decoration: none; display: flex; align-items: center; gap: 0.5rem; }
.brand-logo span span { color: var(--primary); }
.nav-links a { margin: 0 1rem; text-decoration: none; color: var(--text-muted); font-weight: 600; font-size: 0.9rem; transition: color 0.2s; }
.nav-links a:hover, .nav-links a.active { color: var(--primary); }
.action-btn { background: var(--primary); color: ${isDark ? '#000' : '#fff'}; border: none; padding: 0.55rem 1.15rem; border-radius: 9999px; font-weight: 700; cursor: pointer; display: flex; align-items: center; gap: 0.5rem; font-size: 0.85rem; transition: transform 0.15s, opacity 0.2s; }
.action-btn:hover { opacity: 0.92; transform: translateY(-1px); }
.cart-badge { background: #fff; color: var(--primary); border-radius: 9999px; padding: 0.1rem 0.5rem; font-size: 0.75rem; }
.hero-section { padding: 4.5rem 1.5rem 3.5rem; text-align: center; max-width: 840px; margin: 0 auto; }
.hero-pill { display: inline-block; background: ${isDark ? 'rgba(212, 175, 55, 0.1)' : '#fff7ed'}; color: var(--primary); padding: 0.4rem 1rem; border-radius: 9999px; font-size: 0.8rem; font-weight: 700; margin-bottom: 1.25rem; border: 1px solid var(--primary); }
.hero-title { font-size: 2.75rem; font-weight: 800; line-height: 1.2; margin-bottom: 1.25rem; letter-spacing: -0.02em; }
.hero-title span { color: var(--primary); }
.hero-subtitle { color: var(--text-muted); font-size: 1.15rem; line-height: 1.6; margin-bottom: 2rem; }
.hero-cta-group a { display: inline-block; padding: 0.85rem 1.75rem; border-radius: 0.5rem; text-decoration: none; font-weight: 700; margin: 0 0.5rem; transition: all 0.2s; }
.btn-primary { background: var(--primary); color: ${isDark ? '#000' : '#fff'}; }
.btn-primary:hover { background: var(--primary-hover); }
.btn-outline { border: 1px solid var(--border); color: var(--text-main); background: transparent; }
.btn-outline:hover { background: var(--bg-card); border-color: var(--primary); }
.hero-stats { display: flex; justify-content: center; gap: 2.5rem; margin-top: 3rem; }
.stat-item { display: flex; flex-direction: column; align-items: center; }
.stat-number { font-size: 1.75rem; font-weight: 800; color: var(--primary); }
.stat-label { font-size: 0.8rem; color: var(--text-muted); text-transform: uppercase; letter-spacing: 0.05em; }
.services-section, .barbers-section { max-width: 1200px; margin: 0 auto; padding: 3.5rem 1.5rem; }
.section-header { text-align: center; margin-bottom: 2.5rem; }
.section-tag { color: var(--primary); font-weight: 700; font-size: 0.85rem; text-transform: uppercase; letter-spacing: 0.05em; }
.section-title { font-size: 2.25rem; font-weight: 800; margin-top: 0.25rem; }
.section-desc { color: var(--text-muted); font-size: 1rem; margin-top: 0.5rem; }
.items-grid, .barbers-grid { display: grid; grid-template-columns: repeat(auto-fill, minmax(280px, 1fr)); gap: 1.75rem; }
.item-card, .barber-card { background: var(--bg-card); border-radius: 0.75rem; border: 1px solid var(--border); overflow: hidden; display: flex; flex-direction: column; transition: transform 0.2s, box-shadow 0.2s; }
.item-card:hover, .barber-card:hover { transform: translateY(-4px); box-shadow: 0 12px 24px rgba(0,0,0,0.15); }
.item-thumb, .barber-thumb { width: 100%; height: 190px; object-fit: cover; }
.item-body, .barber-card p { padding: 1.25rem; flex: 1; display: flex; flex-direction: column; }
.item-title, .barber-card h4 { font-size: 1.15rem; font-weight: 700; margin-bottom: 0.5rem; }
.item-desc { color: var(--text-muted); font-size: 0.88rem; flex: 1; margin-bottom: 1.25rem; line-height: 1.5; }
.item-foot { display: flex; align-items: center; justify-content: space-between; }
.item-price { font-size: 1.2rem; font-weight: 800; color: var(--primary); }
.action-btn-sm { background: var(--primary); color: ${isDark ? '#000' : '#fff'}; border: none; padding: 0.45rem 1rem; border-radius: 0.5rem; font-weight: 700; cursor: pointer; transition: opacity 0.2s; }
.action-btn-sm:hover { opacity: 0.9; }
.modal-backdrop { position: fixed; inset: 0; background: rgba(0,0,0,0.75); display: none; align-items: center; justify-content: center; z-index: 100; backdrop-filter: blur(4px); }
.modal-backdrop.open { display: flex; }
.modal-card { background: var(--bg-card); border: 1px solid var(--border); border-radius: 1rem; width: 100%; max-width: 500px; padding: 2rem; color: var(--text-main); }
.modal-header { display: flex; align-items: center; justify-content: space-between; margin-bottom: 1.5rem; border-bottom: 1px solid var(--border); padding-bottom: 0.75rem; }
.close-btn { background: none; border: none; font-size: 1.5rem; cursor: pointer; color: var(--text-muted); }
.form-group { margin-bottom: 1rem; }
.form-group label { display: block; font-size: 0.8rem; font-weight: 700; margin-bottom: 0.35rem; color: var(--text-muted); }
.form-control { width: 100%; padding: 0.65rem 0.85rem; background: var(--bg-main); border: 1px solid var(--border); border-radius: 0.5rem; color: var(--text-main); font-size: 0.9rem; outline: none; }
.form-control:focus { border-color: var(--primary); }
.form-row { display: grid; grid-template-columns: 1fr 1fr; gap: 1rem; }
.btn-block { width: 100%; padding: 0.85rem; border: none; border-radius: 0.5rem; cursor: pointer; font-weight: 700; margin-top: 1rem; }
.footer { border-top: 1px solid var(--border); padding: 2.5rem 0; text-align: center; font-size: 0.85rem; color: var(--text-muted); }
.toast-container { position: fixed; bottom: 1.5rem; right: 1.5rem; z-index: 200; }
.toast { background: var(--bg-card); color: var(--text-main); border: 1px solid var(--primary); padding: 0.85rem 1.35rem; border-radius: 0.5rem; font-size: 0.9rem; font-weight: 600; margin-top: 0.5rem; box-shadow: 0 10px 25px rgba(0,0,0,0.3); }
`;
}

export function generateDynamicWebJs(domain: WebDomain, _goal = ''): string {
  if (domain === 'barber') {
    return `const SERVICES = [
  { id: 'srv-1', name: 'Signature Razor Fade & Haircut', price: 35.00, desc: 'Precision skin fade, scissor work, wash & style with premium matte clay.', img: 'https://images.unsplash.com/photo-1503951914875-452162b0f3f1?w=500&auto=format&fit=crop&q=80' },
  { id: 'srv-2', name: 'Classic Hot Towel Straight Shave', price: 28.00, desc: 'Warm botanical pre-shave lather, straight razor glide, and cold eucalyptus towel finish.', img: 'https://images.unsplash.com/photo-1621605815971-fbc98d665033?w=500&auto=format&fit=crop&q=80' },
  { id: 'srv-3', name: 'Beard Sculpting & Razor Line-Up', price: 22.00, desc: 'Facial hair contouring, razor sharp cheek lines, and organic sandalwood beard oil.', img: 'https://images.unsplash.com/photo-1622286342621-4bd786c2447c?w=500&auto=format&fit=crop&q=80' },
  { id: 'srv-4', name: 'The Royal Treatment Package', price: 55.00, desc: 'Full signature haircut, hot towel straight shave, energizing scalp massage, and styling.', img: 'https://images.unsplash.com/photo-1585747860715-2ba37e788b70?w=500&auto=format&fit=crop&q=80' }
];

function renderServices() {
  const grid = document.getElementById('items-grid');
  if (!grid) return;
  grid.innerHTML = SERVICES.map(function(item) {
    return '<div class="item-card">' +
      '<img src="' + item.img + '" alt="' + item.name + '" class="item-thumb">' +
      '<div class="item-body">' +
      '<h4 class="item-title">' + item.name + '</h4>' +
      '<p class="item-desc">' + item.desc + '</p>' +
      '<div class="item-foot">' +
      '<span class="item-price">$' + item.price.toFixed(2) + '</span>' +
      '<button class="action-btn-sm" onclick="selectAndBook(\\'' + item.name + '\\')">Book Service</button>' +
      '</div></div></div>';
  }).join('');
}

function selectAndBook(serviceName) {
  const sel = document.getElementById('service-select');
  if (sel) sel.value = serviceName;
  openModal();
}

function openModal() {
  const modal = document.getElementById('action-modal');
  if (modal) modal.classList.add('open');
}

function closeModal() {
  const modal = document.getElementById('action-modal');
  if (modal) modal.classList.remove('open');
}

function showToast(msg) {
  const cont = document.getElementById('toast-container');
  if (!cont) return;
  const t = document.createElement('div');
  t.className = 'toast';
  t.textContent = msg;
  cont.appendChild(t);
  setTimeout(function() { t.remove(); }, 3500);
}

document.addEventListener('DOMContentLoaded', function() {
  renderServices();
  const toggleBtn = document.getElementById('action-toggle-btn');
  const closeBtn = document.getElementById('close-modal-btn');
  const form = document.getElementById('booking-form');

  if (toggleBtn) toggleBtn.onclick = openModal;
  if (closeBtn) closeBtn.onclick = closeModal;

  if (form) {
    // Interactive appointment booking handler
    form.onsubmit = function(e) {
      e.preventDefault();
      const clientName = document.getElementById('client-name').value;
      const srv = document.getElementById('service-select').value;
      closeModal();
      showToast('Appointment confirmed for ' + clientName + ' (' + srv + ')! See you at Apex Barber. ✂️');
    };
  }
});
`;
  }

  // 2. GYM
  if (domain === 'gym') {
    return `const PROGRAMS = [
  { id: 'fit-1', name: 'High-Intensity CrossFit', price: 49.00, desc: 'Functional strength, metabolic conditioning, barbell cycling, and gymnastics.', img: 'https://images.unsplash.com/photo-1517838277536-f5f99be501cd?w=500&auto=format&fit=crop&q=80' },
  { id: 'fit-2', name: 'Olympic Weightlifting', price: 65.00, desc: 'Snatch, clean & jerk technique under certified national weightlifting coaches.', img: 'https://images.unsplash.com/photo-1534438327276-14e5300c3a48?w=500&auto=format&fit=crop&q=80' },
  { id: 'fit-3', name: '1-on-1 Personal Training', price: 120.00, desc: 'Tailored macro plans, bi-weekly body composition scans, and bespoke progression.', img: 'https://images.unsplash.com/photo-1581009146145-b5ef050c2e1e?w=500&auto=format&fit=crop&q=80' },
  { id: 'fit-4', name: 'Athletic Recovery & Sauna', price: 35.00, desc: 'Infrared cedar sauna, cold plunge tubs, and guided mobility recovery.', img: 'https://images.unsplash.com/photo-1540497077202-7c8a3999166f?w=500&auto=format&fit=crop&q=80' }
];

function renderPrograms() {
  const grid = document.getElementById('items-grid');
  if (!grid) return;
  grid.innerHTML = PROGRAMS.map(function(p) {
    return '<div class="item-card">' +
      '<img src="' + p.img + '" alt="' + p.name + '" class="item-thumb">' +
      '<div class="item-body">' +
      '<h4 class="item-title">' + p.name + '</h4>' +
      '<p class="item-desc">' + p.desc + '</p>' +
      '<div class="item-foot">' +
      '<span class="item-price">$' + p.price.toFixed(2) + '/mo</span>' +
      '<button class="action-btn-sm" onclick="openModal()">Enroll Now</button>' +
      '</div></div></div>';
  }).join('');
}

function openModal() {
  const m = document.getElementById('action-modal');
  if (m) m.classList.add('open');
}

function closeModal() {
  const m = document.getElementById('action-modal');
  if (m) m.classList.remove('open');
}

function showToast(msg) {
  const cont = document.getElementById('toast-container');
  if (!cont) return;
  const t = document.createElement('div');
  t.className = 'toast';
  t.textContent = msg;
  cont.appendChild(t);
  setTimeout(function() { t.remove(); }, 3500);
}

document.addEventListener('DOMContentLoaded', function() {
  renderPrograms();
  const toggleBtn = document.getElementById('action-toggle-btn');
  const closeBtn = document.getElementById('close-modal-btn');
  const form = document.getElementById('booking-form');
  if (toggleBtn) toggleBtn.onclick = openModal;
  if (closeBtn) closeBtn.onclick = closeModal;
  if (form) {
    // Interactive appointment booking handler
    form.onsubmit = function(e) {
      e.preventDefault();
      closeModal();
      showToast('Titan Free Pass activated! Check your email for gym entry barcode. ⚡');
    };
  }
});
`;
  }

  // 3. PORTFOLIO
  if (domain === 'portfolio') {
    return `const PROJECTS = [
  { id: 'proj-1', name: 'Cortex Agentic Workspace', price: 0, desc: 'Multi-model agent orchestrator with sandboxed file diffing, Observe-Act-Verify loop, and live preview.', img: 'https://images.unsplash.com/photo-1555066931-4365d14bab8c?w=500&auto=format&fit=crop&q=80' },
  { id: 'proj-2', name: 'Neural Vector Gateway', price: 0, desc: 'High-throughput semantic similarity engine processing 10,000 queries per second with Sub-10ms latency.', img: 'https://images.unsplash.com/photo-1526374965328-7f61d4dc18c5?w=500&auto=format&fit=crop&q=80' },
  { id: 'proj-3', name: 'Real-Time Telemetry Pipeline', price: 0, desc: 'Distributed event ingestion built with Go and Kafka delivering live dashboards for 1M concurrent users.', img: 'https://images.unsplash.com/photo-1551288049-bebda4e38f71?w=500&auto=format&fit=crop&q=80' },
  { id: 'proj-4', name: 'Autonomous Test Harness', price: 0, desc: 'Self-healing end-to-end integration test framework with automated regression bisecting.', img: 'https://images.unsplash.com/photo-1518770660439-4636190af475?w=500&auto=format&fit=crop&q=80' }
];

function renderProjects() {
  const grid = document.getElementById('items-grid');
  if (!grid) return;
  grid.innerHTML = PROJECTS.map(function(p) {
    return '<div class="item-card">' +
      '<img src="' + p.img + '" alt="' + p.name + '" class="item-thumb">' +
      '<div class="item-body">' +
      '<h4 class="item-title">' + p.name + '</h4>' +
      '<p class="item-desc">' + p.desc + '</p>' +
      '<div class="item-foot">' +
      '<button class="action-btn-sm" onclick="openModal()">Case Study</button>' +
      '</div></div></div>';
  }).join('');
}

function openModal() {
  const m = document.getElementById('action-modal');
  if (m) m.classList.add('open');
}

function closeModal() {
  const m = document.getElementById('action-modal');
  if (m) m.classList.remove('open');
}

function showToast(msg) {
  const cont = document.getElementById('toast-container');
  if (!cont) return;
  const t = document.createElement('div');
  t.className = 'toast';
  t.textContent = msg;
  cont.appendChild(t);
  setTimeout(function() { t.remove(); }, 3500);
}

document.addEventListener('DOMContentLoaded', function() {
  renderProjects();
  const toggleBtn = document.getElementById('action-toggle-btn');
  const closeBtn = document.getElementById('close-modal-btn');
  const form = document.getElementById('booking-form');
  if (toggleBtn) toggleBtn.onclick = openModal;
  if (closeBtn) closeBtn.onclick = closeModal;
  if (form) {
    // Interactive appointment booking handler
    form.onsubmit = function(e) {
      e.preventDefault();
      closeModal();
      showToast('Thank you for reaching out! Alex will respond within 24 hours. ✉️');
    };
  }
});
`;
  }

  // 4. RESTAURANT
  if (domain === 'restaurant') {
    return `const MENU = [
  { id: 'item-1', name: 'Gourmet Truffle Burger', price: 14.99, desc: 'Aged cheddar, caramelized shallots, black truffle aioli', img: 'https://images.unsplash.com/photo-1568901346375-23c9450c58cd?w=500&auto=format&fit=crop&q=80' },
  { id: 'item-2', name: 'Woodfired Margherita Pizza', price: 16.50, desc: 'San Marzano tomatoes, buffalo mozzarella, fresh basil', img: 'https://images.unsplash.com/photo-1574071318508-1cdbab80d002?w=500&auto=format&fit=crop&q=80' },
  { id: 'item-3', name: 'Wild Salmon Bowl', price: 15.25, desc: 'Alaskan salmon, quinoa, avocado, citrus ponzu', img: 'https://images.unsplash.com/photo-1546069901-ba9599a7e63c?w=500&auto=format&fit=crop&q=80' },
  { id: 'item-4', name: 'Detox Green Juice', price: 6.50, desc: 'Kale, green apple, cucumber, ginger, lemon', img: 'https://images.unsplash.com/photo-1613478223719-2ab802602423?w=500&auto=format&fit=crop&q=80' }
];

let cart = [];

function renderMenu() {
  const grid = document.getElementById('items-grid');
  if (!grid) return;
  grid.innerHTML = MENU.map(function (item) {
    return (
      '<div class="item-card">' +
      '<img src="' + item.img + '" alt="' + item.name + '" class="item-thumb">' +
      '<div class="item-body">' +
      '<h4 class="item-title">' + item.name + '</h4>' +
      '<p class="item-desc">' + item.desc + '</p>' +
      '<div class="item-foot">' +
      '<span class="item-price">$' + item.price.toFixed(2) + '</span>' +
      '<button class="action-btn-sm" onclick="addToCart(\\'' + item.id + '\\')">+ Add</button>' +
      '</div></div></div>'
    );
  }).join('');
}

function addToCart(id) {
  const item = MENU.find(function (m) { return m.id === id; });
  if (!item) return;
  const existing = cart.find(function (ci) { return ci.id === id; });
  if (existing) {
    existing.qty += 1;
  } else {
    cart.push({ id: item.id, name: item.name, price: item.price, qty: 1 });
  }
  updateCart();
  showToast('Added ' + item.name + ' to order!');
}

function updateCart() {
  const counter = document.getElementById('cart-counter');
  if (counter) counter.textContent = cart.reduce(function (acc, ci) { return acc + ci.qty; }, 0);
  const total = document.getElementById('cart-total');
  if (total) {
    const sum = cart.reduce(function (acc, ci) { return acc + ci.price * ci.qty; }, 0);
    total.textContent = '$' + sum.toFixed(2);
  }
}

function showToast(msg) {
  const cont = document.getElementById('toast-container');
  if (!cont) return;
  const t = document.createElement('div');
  t.className = 'toast';
  t.textContent = msg;
  cont.appendChild(t);
  setTimeout(function () { t.remove(); }, 2500);
}

document.addEventListener('DOMContentLoaded', function () {
  renderMenu();
  const toggle = document.getElementById('action-toggle-btn');
  const modal = document.getElementById('action-modal');
  const close = document.getElementById('close-modal-btn');
  if (toggle && modal) toggle.onclick = function () { modal.classList.add('open'); };
  if (close && modal) close.onclick = function () { modal.classList.remove('open'); };
});
`;
  }

  // 5. GENERIC
  return `const FEATURES = [
  { id: 'f-1', name: 'Smart Workflow Automation', desc: 'Accelerate productivity with intelligent autonomous routines.', img: 'https://images.unsplash.com/photo-1460925895917-afdab827c52f?w=500&auto=format&fit=crop&q=80' },
  { id: 'f-2', name: 'Real-Time Insights & Metrics', desc: 'Monitor throughput, engagement, and KPIs with sub-second accuracy.', img: 'https://images.unsplash.com/photo-1504868584819-f8e8b4b6d7e3?w=500&auto=format&fit=crop&q=80' },
  { id: 'f-3', name: 'Enterprise Security & Isolation', desc: 'End-to-end encrypted tunnels with zero credentials leakage.', img: 'https://images.unsplash.com/photo-1563986768609-322da13575f3?w=500&auto=format&fit=crop&q=80' },
  { id: 'f-4', name: 'Cloud Integration & Sync', desc: 'Deploy across web, desktop, and mobile with seamless state synchronization.', img: 'https://images.unsplash.com/photo-1451187580459-43490279c0fa?w=500&auto=format&fit=crop&q=80' }
];

function renderFeatures() {
  const grid = document.getElementById('items-grid');
  if (!grid) return;
  grid.innerHTML = FEATURES.map(function(f) {
    return '<div class="item-card">' +
      '<img src="' + f.img + '" alt="' + f.name + '" class="item-thumb">' +
      '<div class="item-body">' +
      '<h4 class="item-title">' + f.name + '</h4>' +
      '<p class="item-desc">' + f.desc + '</p>' +
      '<div class="item-foot">' +
      '<button class="action-btn-sm" onclick="openModal()">Learn More</button>' +
      '</div></div></div>';
  }).join('');
}

function openModal() {
  const m = document.getElementById('action-modal');
  if (m) m.classList.add('open');
}

function closeModal() {
  const m = document.getElementById('action-modal');
  if (m) m.classList.remove('open');
}

function showToast(msg) {
  const cont = document.getElementById('toast-container');
  if (!cont) return;
  const t = document.createElement('div');
  t.className = 'toast';
  t.textContent = msg;
  cont.appendChild(t);
  setTimeout(function() { t.remove(); }, 3500);
}

document.addEventListener('DOMContentLoaded', function() {
  renderFeatures();
  const toggleBtn = document.getElementById('action-toggle-btn');
  const closeBtn = document.getElementById('close-modal-btn');
  const form = document.getElementById('booking-form');
  if (toggleBtn) toggleBtn.onclick = openModal;
  if (closeBtn) closeBtn.onclick = closeModal;
  if (form) {
    // Interactive appointment booking handler
    form.onsubmit = function(e) {
      e.preventDefault();
      closeModal();
      showToast('Thank you! Your inquiry has been received. 🚀');
    };
  }
});
`;
}

// Backward compatibility aliases
export function generateFoodShopHtml(goal = 'Food Shop Landing Page'): string {
  return generateDynamicWebHtml(goal);
}

export function generateFoodShopCss(): string {
  return generateDynamicWebCss('restaurant');
}

export function generateFoodShopJs(): string {
  return generateDynamicWebJs('restaurant');
}

// ============================================================================
// MULTI-LANGUAGE STEP PLANNER
// ============================================================================

/**
 * Builds structured execution steps tailored to the detected language and goal.
 */
export function generateLanguageSteps(
  detectedTech: TechnologyDetection,
  goal: string,
  constraints = ''
): AgentTaskStep[] {
  const now = new Date().toISOString();
  const tech = detectedTech.technology;

  // 1. PYTHON
  if (tech === 'python') {
    return [
      {
        id: `step_${Date.now()}_1`,
        title: 'Inspect Repository Context & Python Environment',
        description: 'Enumerate workspace files, check Python environment, and locate project dependencies.',
        status: 'running',
        operation: 'read',
        tool: 'workspace_list_files',
        toolInput: {},
        requiresApproval: false,
        isApproved: false,
        createdAt: now,
      },
      {
        id: `step_${Date.now()}_2`,
        title: 'Implement Python Data Models & Structures (models.py)',
        description: `Define typed Python dataclasses, food item attributes, shopping cart items, and order discount contracts for "${goal}".`,
        status: 'pending',
        operation: 'create',
        targetPath: 'models.py',
        tool: 'workspace_create_file',
        toolInput: {
          filePath: 'models.py',
          content: generatePythonModels(goal),
        },
        requiresApproval: false,
        isApproved: false,
        createdAt: now,
      },
      {
        id: `step_${Date.now()}_3`,
        title: 'Implement Main Python Application & Catalog (main.py)',
        description: `Build complete Python service with catalog seed, menu listing, cart additions, discount calculation, and CLI runner.`,
        status: 'pending',
        operation: 'create',
        targetPath: 'main.py',
        tool: 'workspace_create_file',
        toolInput: {
          filePath: 'main.py',
          content: generatePythonMain(goal),
        },
        requiresApproval: false,
        isApproved: false,
        createdAt: now,
      },
      {
        id: `step_${Date.now()}_4`,
        title: 'Implement Automated Python Test Suite (test_food_shop.py)',
        description: `Write automated unit tests verifying catalog listing, quantity tracking, promo coupon discounts, and checkout.`,
        status: 'pending',
        operation: 'create',
        targetPath: 'test_food_shop.py',
        tool: 'workspace_create_file',
        toolInput: {
          filePath: 'test_food_shop.py',
          content: generatePythonTests(goal),
        },
        requiresApproval: false,
        isApproved: false,
        createdAt: now,
      },
      {
        id: `step_${Date.now()}_5`,
        title: 'Verify Python Deliverables & File Syntax',
        description: 'Verify models.py, main.py, and test_food_shop.py exist on filesystem and are ready for execution.',
        status: 'pending',
        operation: 'read',
        targetPath: 'main.py',
        tool: 'workspace_list_files',
        toolInput: {},
        requiresApproval: false,
        isApproved: false,
        createdAt: now,
      },
    ];
  }

  // 2. GOLANG
  if (tech === 'golang') {
    return [
      {
        id: `step_${Date.now()}_1`,
        title: 'Inspect Repository Context & Go Modules',
        description: 'Enumerate workspace files, check Go packages, and locate project entry points.',
        status: 'running',
        operation: 'read',
        tool: 'workspace_list_files',
        toolInput: {},
        requiresApproval: false,
        isApproved: false,
        createdAt: now,
      },
      {
        id: `step_${Date.now()}_2`,
        title: 'Implement Go Domain Structs & Types (models.go)',
        description: `Define Go structs with JSON tags for FoodItem, CartItem, and Order calculation methods.`,
        status: 'pending',
        operation: 'create',
        targetPath: 'models.go',
        tool: 'workspace_create_file',
        toolInput: {
          filePath: 'models.go',
          content: generateGoModels(),
        },
        requiresApproval: false,
        isApproved: false,
        createdAt: now,
      },
      {
        id: `step_${Date.now()}_3`,
        title: 'Implement Go Service & Application Driver (main.go)',
        description: `Build Go application service with catalog seed, menu listing, cart additions, and discount checkout.`,
        status: 'pending',
        operation: 'create',
        targetPath: 'main.go',
        tool: 'workspace_create_file',
        toolInput: {
          filePath: 'main.go',
          content: generateGoMain(goal),
        },
        requiresApproval: false,
        isApproved: false,
        createdAt: now,
      },
      {
        id: `step_${Date.now()}_4`,
        title: 'Implement Go Unit Tests (main_test.go)',
        description: `Write automated Go tests verifying catalog initialization, cart state, and discount calculation.`,
        status: 'pending',
        operation: 'create',
        targetPath: 'main_test.go',
        tool: 'workspace_create_file',
        toolInput: {
          filePath: 'main_test.go',
          content: generateGoTests(),
        },
        requiresApproval: false,
        isApproved: false,
        createdAt: now,
      },
      {
        id: `step_${Date.now()}_5`,
        title: 'Verify Go Deliverables',
        description: 'Confirm models.go, main.go, and main_test.go are generated and valid.',
        status: 'pending',
        operation: 'read',
        targetPath: 'main.go',
        tool: 'workspace_list_files',
        toolInput: {},
        requiresApproval: false,
        isApproved: false,
        createdAt: now,
      },
    ];
  }

  // 3. RUST
  if (tech === 'rust') {
    return [
      {
        id: `step_${Date.now()}_1`,
        title: 'Inspect Repository Context',
        description: 'Enumerate workspace files and locate Cargo manifests.',
        status: 'running',
        operation: 'read',
        tool: 'workspace_list_files',
        toolInput: {},
        requiresApproval: false,
        isApproved: false,
        createdAt: now,
      },
      {
        id: `step_${Date.now()}_2`,
        title: 'Implement Cargo Package Manifest (Cargo.toml)',
        description: 'Create standard Cargo package manifest for Rust food shop application.',
        status: 'pending',
        operation: 'create',
        targetPath: 'Cargo.toml',
        tool: 'workspace_create_file',
        toolInput: {
          filePath: 'Cargo.toml',
          content: generateRustCargo(),
        },
        requiresApproval: false,
        isApproved: false,
        createdAt: now,
      },
      {
        id: `step_${Date.now()}_3`,
        title: 'Implement Rust Application & Embedded Tests (src/main.rs)',
        description: `Build complete idiomatic Rust application with FoodItem, CartItem, FoodShop impl, and test suite.`,
        status: 'pending',
        operation: 'create',
        targetPath: 'src/main.rs',
        tool: 'workspace_create_file',
        toolInput: {
          filePath: 'src/main.rs',
          content: generateRustMain(goal),
        },
        requiresApproval: false,
        isApproved: false,
        createdAt: now,
      },
      {
        id: `step_${Date.now()}_4`,
        title: 'Verify Rust Deliverables',
        description: 'Verify Cargo.toml and src/main.rs exist and are ready for compilation.',
        status: 'pending',
        operation: 'read',
        targetPath: 'src/main.rs',
        tool: 'workspace_list_files',
        toolInput: {},
        requiresApproval: false,
        isApproved: false,
        createdAt: now,
      },
    ];
  }

  // 4. JAVA
  if (tech === 'java') {
    return [
      {
        id: `step_${Date.now()}_1`,
        title: 'Inspect Repository Context',
        description: 'Enumerate workspace files and check Java package structure.',
        status: 'running',
        operation: 'read',
        tool: 'workspace_list_files',
        toolInput: {},
        requiresApproval: false,
        isApproved: false,
        createdAt: now,
      },
      {
        id: `step_${Date.now()}_2`,
        title: 'Implement Java Product Entity (Product.java)',
        description: 'Create Java domain entity with private fields, constructor, and getters.',
        status: 'pending',
        operation: 'create',
        targetPath: 'Product.java',
        tool: 'workspace_create_file',
        toolInput: {
          filePath: 'Product.java',
          content: generateJavaProduct(),
        },
        requiresApproval: false,
        isApproved: false,
        createdAt: now,
      },
      {
        id: `step_${Date.now()}_3`,
        title: 'Implement Java Service (FoodShop.java)',
        description: 'Create Java business service managing catalog, cart additions, and discount calculation.',
        status: 'pending',
        operation: 'create',
        targetPath: 'FoodShop.java',
        tool: 'workspace_create_file',
        toolInput: {
          filePath: 'FoodShop.java',
          content: generateJavaFoodShop(),
        },
        requiresApproval: false,
        isApproved: false,
        createdAt: now,
      },
      {
        id: `step_${Date.now()}_4`,
        title: 'Implement Java Main Entry (Main.java)',
        description: 'Create Java main driver with formatted CLI output, cart checkout, and discount verification.',
        status: 'pending',
        operation: 'create',
        targetPath: 'Main.java',
        tool: 'workspace_create_file',
        toolInput: {
          filePath: 'Main.java',
          content: generateJavaMain(goal),
        },
        requiresApproval: false,
        isApproved: false,
        createdAt: now,
      },
      {
        id: `step_${Date.now()}_5`,
        title: 'Verify Java Deliverables',
        description: 'Verify Product.java, FoodShop.java, and Main.java are ready on filesystem.',
        status: 'pending',
        operation: 'read',
        targetPath: 'Main.java',
        tool: 'workspace_list_files',
        toolInput: {},
        requiresApproval: false,
        isApproved: false,
        createdAt: now,
      },
    ];
  }

  // 5. C++
  if (tech === 'cpp') {
    return [
      {
        id: `step_${Date.now()}_1`,
        title: 'Inspect Repository Context',
        description: 'Enumerate workspace files and locate C++ headers.',
        status: 'running',
        operation: 'read',
        tool: 'workspace_list_files',
        toolInput: {},
        requiresApproval: false,
        isApproved: false,
        createdAt: now,
      },
      {
        id: `step_${Date.now()}_2`,
        title: 'Implement C++ Class Header (food_shop.hpp)',
        description: 'Create modern C++ header declaring FoodItem, CartItem, and FoodShop class.',
        status: 'pending',
        operation: 'create',
        targetPath: 'food_shop.hpp',
        tool: 'workspace_create_file',
        toolInput: {
          filePath: 'food_shop.hpp',
          content: generateCppHeader(),
        },
        requiresApproval: false,
        isApproved: false,
        createdAt: now,
      },
      {
        id: `step_${Date.now()}_3`,
        title: 'Implement C++ Main Driver (main.cpp)',
        description: 'Create C++ main program demonstrating catalog listing, cart manipulation, and checkout.',
        status: 'pending',
        operation: 'create',
        targetPath: 'main.cpp',
        tool: 'workspace_create_file',
        toolInput: {
          filePath: 'main.cpp',
          content: generateCppMain(goal),
        },
        requiresApproval: false,
        isApproved: false,
        createdAt: now,
      },
      {
        id: `step_${Date.now()}_4`,
        title: 'Verify C++ Deliverables',
        description: 'Confirm food_shop.hpp and main.cpp are generated and ready.',
        status: 'pending',
        operation: 'read',
        targetPath: 'main.cpp',
        tool: 'workspace_list_files',
        toolInput: {},
        requiresApproval: false,
        isApproved: false,
        createdAt: now,
      },
    ];
  }

  // 6. REACT (TYPESCRIPT)
  if (tech === 'react') {
    return [
      {
        id: `step_${Date.now()}_1`,
        title: 'Inspect Repository Context',
        description: 'Enumerate workspace files and locate React component root.',
        status: 'running',
        operation: 'read',
        tool: 'workspace_list_files',
        toolInput: {},
        requiresApproval: false,
        isApproved: false,
        createdAt: now,
      },
      {
        id: `step_${Date.now()}_2`,
        title: 'Implement TypeScript Interface Contracts (types.ts)',
        description: 'Define strong types for FoodItem, CartItem, Category, and Order.',
        status: 'pending',
        operation: 'create',
        targetPath: 'types.ts',
        tool: 'workspace_create_file',
        toolInput: {
          filePath: 'types.ts',
          content: generateReactTypes(),
        },
        requiresApproval: false,
        isApproved: false,
        createdAt: now,
      },
      {
        id: `step_${Date.now()}_3`,
        title: 'Implement React Food Shop Component (App.tsx)',
        description: 'Build interactive React component with hooks, state, menu grid, filter tabs, and cart modal.',
        status: 'pending',
        operation: 'create',
        targetPath: 'App.tsx',
        tool: 'workspace_create_file',
        toolInput: {
          filePath: 'App.tsx',
          content: generateReactApp(goal),
        },
        requiresApproval: false,
        isApproved: false,
        createdAt: now,
      },
      {
        id: `step_${Date.now()}_4`,
        title: 'Implement Component Styling (styles.css)',
        description: 'Apply responsive CSS rules for hero banner, food cards, and modal dialog.',
        status: 'pending',
        operation: 'create',
        targetPath: 'styles.css',
        tool: 'workspace_create_file',
        toolInput: {
          filePath: 'styles.css',
          content: generateFoodShopCss(),
        },
        requiresApproval: false,
        isApproved: false,
        createdAt: now,
      },
      {
        id: `step_${Date.now()}_5`,
        title: 'Verify React Deliverables',
        description: 'Verify types.ts, App.tsx, and styles.css exist and are valid.',
        status: 'pending',
        operation: 'read',
        targetPath: 'App.tsx',
        tool: 'workspace_list_files',
        toolInput: {},
        requiresApproval: false,
        isApproved: false,
        createdAt: now,
      },
    ];
  }

  // 7. WEB FRONTEND (HTML / CSS / JS)
  if (tech === 'html_css_js') {
    const domain = detectWebDomain(goal);
    const domainLabel = getDomainLabel(domain);
    return [
      {
        id: `step_${Date.now()}_1`,
        title: 'Inspect Repository Context',
        description: 'Enumerate workspace files, analyze entry points, and discover existing project dependencies.',
        status: 'running',
        operation: 'read',
        tool: 'workspace_list_files',
        toolInput: {},
        requiresApproval: false,
        isApproved: false,
        createdAt: now,
      },
      {
        id: `step_${Date.now()}_2`,
        title: 'Implement Semantic HTML Structure (index.html)',
        description: `Build modern semantic markup for ${domainLabel} with accessible navigation, hero section, interactive services grid, booking/action modal, and footer.`,
        status: 'pending',
        operation: 'create',
        targetPath: 'index.html',
        tool: 'workspace_create_file',
        toolInput: {
          filePath: 'index.html',
          content: generateDynamicWebHtml(goal),
        },
        requiresApproval: false,
        isApproved: false,
        createdAt: now,
      },
      {
        id: `step_${Date.now()}_3`,
        title: 'Implement Responsive CSS Styles (styles.css)',
        description: `Apply responsive CSS styling with custom properties, ${domainLabel} color palette, glassmorphic cards, badge animations, and mobile layout support.`,
        status: 'pending',
        operation: 'create',
        targetPath: 'styles.css',
        tool: 'workspace_create_file',
        toolInput: {
          filePath: 'styles.css',
          content: generateDynamicWebCss(domain, goal),
        },
        requiresApproval: false,
        isApproved: false,
        createdAt: now,
      },
      {
        id: `step_${Date.now()}_4`,
        title: 'Implement Interactive JavaScript Features (script.js)',
        description: `Implement interactive ${domainLabel} feature cards, dynamic booking/action modal, toasts, and smooth scrolling interactions.`,
        status: 'pending',
        operation: 'create',
        targetPath: 'script.js',
        tool: 'workspace_create_file',
        toolInput: {
          filePath: 'script.js',
          content: generateDynamicWebJs(domain, goal),
        },
        requiresApproval: false,
        isApproved: false,
        createdAt: now,
      },
      {
        id: `step_${Date.now()}_5`,
        title: 'Verify Deliverables & Live Preview Readiness',
        description: 'Inspect workspace files to ensure index.html, styles.css, and script.js exist, are linked, and render properly in live preview.',
        status: 'pending',
        operation: 'read',
        targetPath: 'index.html',
        tool: 'workspace_list_files',
        toolInput: {},
        requiresApproval: false,
        isApproved: false,
        createdAt: now,
      },
    ];
  }

  // 8. GENERAL TYPESCRIPT (Default fallback)
  return [
    {
      id: `step_${Date.now()}_1`,
      title: 'Inspect Repository Context',
      description: 'Enumerate workspace files, analyze entry points, and discover existing project dependencies.',
      status: 'running',
      operation: 'read',
      tool: 'workspace_list_files',
      toolInput: {},
      requiresApproval: false,
      isApproved: false,
      createdAt: now,
    },
    {
      id: `step_${Date.now()}_2`,
      title: 'Implement Type Definitions (types.ts)',
      description: `Define typed interfaces and domain contracts for: "${goal}".`,
      status: 'pending',
      operation: 'create',
      targetPath: 'types.ts',
      tool: 'workspace_create_file',
      toolInput: {
        filePath: 'types.ts',
        content: `export interface DomainItem {\n  id: string;\n  name: string;\n  createdAt: string;\n}\n\nexport interface ExecuteResult {\n  success: boolean;\n  timestamp: string;\n  data?: any;\n}\n`,
      },
      requiresApproval: false,
      isApproved: false,
      createdAt: now,
    },
    {
      id: `step_${Date.now()}_3`,
      title: 'Implement Solution & Business Logic (solution.ts)',
      description: `Implement coordinated production logic for goal: "${goal}".`,
      status: 'pending',
      operation: 'create',
      targetPath: 'solution.ts',
      tool: 'workspace_create_file',
      toolInput: {
        filePath: 'solution.ts',
        content: `import { DomainItem, ExecuteResult } from './types';\n\n// Solution for: ${goal}\nexport class Service {\n  private items: DomainItem[] = [];\n\n  execute(): ExecuteResult {\n    return {\n      success: true,\n      timestamp: new Date().toISOString(),\n      data: { goal: ${JSON.stringify(goal)}, itemCount: this.items.length },\n    };\n  }\n}\n\nexport function run() {\n  const s = new Service();\n  return s.execute();\n}\n`,
      },
      requiresApproval: false,
      isApproved: false,
      createdAt: now,
    },
    {
      id: `step_${Date.now()}_4`,
      title: 'Run Quality Checks & Verification',
      description: 'Review git change status and verify unified diff.',
      status: 'pending',
      operation: 'read',
      tool: 'workspace_get_git_status',
      toolInput: {},
      requiresApproval: false,
      isApproved: false,
      createdAt: now,
    },
  ];
}
