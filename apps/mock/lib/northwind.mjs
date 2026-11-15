// Deterministic invented Northwind-like data (fixed seed). Not copied from the public Northwind service.
import { Fake, day } from './fake.mjs';

const CATS = [
  ['Bakery', 'Breads, rolls and baked goods', ['Rye Loaf', 'Seed Roll', 'Oat Biscuit', 'Honey Cake', 'Butter Croissant', 'Spelt Bread'], '12 pieces'],
  ['Dairy', 'Milk, cheese and yoghurt', ['Mountain Cheese', 'Cream Yoghurt', 'Goat Milk', 'Smoked Gouda', 'Fresh Butter'], '1 kg'],
  ['Produce', 'Fruit and vegetables', ['Green Apples', 'Sweet Pears', 'Cherry Tomatoes', 'Baby Carrots', 'Red Onions'], '5 kg box'],
  ['Snacks', 'Chips, nuts and bars', ['Sea Salt Chips', 'Roasted Almonds', 'Granola Bar', 'Pretzel Sticks', 'Trail Mix'], '24 bags'],
  ['Drinks', 'Juices, waters and teas', ['Lemon Soda', 'Mint Tea', 'Ginger Ale', 'Sparkling Water', 'Apple Juice'], '12 bottles'],
  ['Frozen', 'Frozen meals and desserts', ['Berry Sorbet', 'Veggie Pizza', 'Fish Fingers', 'Pea Soup', 'Vanilla Ice'], '10 packs'],
  ['Pantry', 'Oils, sauces, grains and spices', ['Olive Oil', 'Tomato Sauce', 'Basmati Rice', 'Chili Flakes', 'Wheat Flour'], '6 jars'],
  ['Household', 'Cleaning and paper goods', ['Dish Soap', 'Paper Towels', 'Glass Cleaner', 'Sponge Pack', 'Trash Bags'], '20 units'],
];
const ADJECTIVES = ['Classic', 'Organic', 'Premium', 'Golden', 'Rustic', 'Alpine', 'Coastal', 'Harvest', 'Northern', 'Daily'];
const TITLES = ['Sales Representative', 'Sales Manager', 'Inside Sales Coordinator', 'Account Executive'];

export function generateNorthwind() {
  const fake = new Fake(20261114);
  const Categories = CATS.map(([CategoryName, Description], i) => ({ CategoryID: i + 1, CategoryName, Description }));
  const Suppliers = Array.from({ length: 30 }, (_, i) => {
    const { country, city } = fake.place();
    return { SupplierID: i + 1, CompanyName: fake.companyName(), ContactName: fake.personName(), City: city, Country: country, Phone: fake.phone() };
  });
  const names = new Set();
  const Products = [];
  for (let i = 1; i <= 500; i++) {
    const ci = fake.next(CATS.length);
    let name;
    do name = `${fake.pick(ADJECTIVES)} ${fake.pick(CATS[ci][2])} ${fake.word()}`; while (names.has(name));
    names.add(name);
    Products.push({
      ProductID: i, ProductName: name, SupplierID: fake.between(1, 30), CategoryID: ci + 1, QuantityPerUnit: CATS[ci][3],
      UnitPrice: fake.dec(1.5, 120, 2), UnitsInStock: fake.between(0, 150), UnitsOnOrder: fake.chance(0.3) ? fake.between(5, 80) : 0,
      ReorderLevel: fake.between(0, 6) * 5, Discontinued: fake.chance(0.08),
    });
  }
  const Customers = [];
  const codes = new Set();
  while (Customers.length < 90) {
    const code = Array.from({ length: 5 }, () => String.fromCharCode(65 + fake.next(26))).join('');
    if (codes.has(code)) continue;
    codes.add(code);
    const { country, city } = fake.place();
    Customers.push({ CustomerID: code, CompanyName: fake.companyName(), ContactName: fake.personName(), City: city, Country: country, Phone: fake.phone() });
  }
  const Employees = Array.from({ length: 9 }, (_, i) => {
    const { country, city } = fake.place();
    return { EmployeeID: i + 1, LastName: fake.lastName(), FirstName: fake.firstName(), Title: fake.pick(TITLES), HireDate: day.add('2015-01-01', fake.next(3000)), City: city, Country: country };
  });
  const Orders = [];
  const OrderDetails = [];
  const start = Date.UTC(2023, 0, 1);
  for (let i = 0; i < 5000; i++) {
    const od = new Date(start + fake.next(60 * 24 * 1400) * 60000);
    const d = od.toISOString().slice(0, 10);
    const cu = fake.pick(Customers);
    const o = {
      OrderID: 20001 + i, CustomerID: cu.CustomerID, EmployeeID: fake.between(1, 9), OrderDate: od.toISOString().replace('.000Z', 'Z'),
      RequiredDate: day.add(d, fake.between(14, 42)), ShippedDate: fake.chance(0.92) ? day.add(d, fake.between(1, 20)) : null,
      Freight: fake.dec(0.5, 400, 2), ShipCity: cu.City, ShipCountry: cu.Country,
    };
    Orders.push(o);
    const n = fake.weighted([[1, 2], [2, 3], [3, 4], [4, 3], [5, 2]]);
    const seen = new Set();
    for (let k = 0; k < n; k++) {
      const p = fake.pick(Products);
      if (seen.has(p.ProductID)) continue;
      seen.add(p.ProductID);
      OrderDetails.push({ OrderID: o.OrderID, ProductID: p.ProductID, UnitPrice: p.UnitPrice, Quantity: fake.between(1, 60), Discount: fake.pick([0, 0, 0, 0.05, 0.1, 0.15]) });
    }
  }
  return { Categories, Suppliers, Products, Customers, Employees, Orders, OrderDetails };
}
