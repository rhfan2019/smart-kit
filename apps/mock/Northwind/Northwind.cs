using Microsoft.Data.Sqlite;
using Microsoft.EntityFrameworkCore;
using Mock.Infrastructure;

namespace Mock.Northwind;

public class Category
{
    public int CategoryID { get; set; }
    public string CategoryName { get; set; } = "";
    public string? Description { get; set; }
    public List<Product> Products { get; set; } = [];
}

public class Supplier
{
    public int SupplierID { get; set; }
    public string CompanyName { get; set; } = "";
    public string? ContactName { get; set; }
    public string? City { get; set; }
    public string? Country { get; set; }
    public string? Phone { get; set; }
    public List<Product> Products { get; set; } = [];
}

public class Product
{
    public int ProductID { get; set; }
    public string ProductName { get; set; } = "";
    public int? SupplierID { get; set; }
    public int? CategoryID { get; set; }
    public string? QuantityPerUnit { get; set; }
    [Precision(19, 4)] public decimal? UnitPrice { get; set; }
    public short? UnitsInStock { get; set; }
    public short? UnitsOnOrder { get; set; }
    public short? ReorderLevel { get; set; }
    public bool Discontinued { get; set; }
    public Category? Category { get; set; }
    public Supplier? Supplier { get; set; }
    public List<OrderDetail> OrderDetails { get; set; } = [];
}

public class Customer
{
    public string CustomerID { get; set; } = "";
    public string CompanyName { get; set; } = "";
    public string? ContactName { get; set; }
    public string? City { get; set; }
    public string? Country { get; set; }
    public string? Phone { get; set; }
    public List<Order> Orders { get; set; } = [];
}

public class Employee
{
    public int EmployeeID { get; set; }
    public string LastName { get; set; } = "";
    public string FirstName { get; set; } = "";
    public string? Title { get; set; }
    public DateOnly? HireDate { get; set; }
    public string? City { get; set; }
    public string? Country { get; set; }
    public List<Order> Orders { get; set; } = [];
}

public class Order
{
    public int OrderID { get; set; }
    public string? CustomerID { get; set; }
    public int? EmployeeID { get; set; }
    public DateTimeOffset? OrderDate { get; set; }
    public DateOnly? RequiredDate { get; set; }
    public DateOnly? ShippedDate { get; set; }
    [Precision(19, 4)] public decimal? Freight { get; set; }
    public string? ShipCity { get; set; }
    public string? ShipCountry { get; set; }
    public Customer? Customer { get; set; }
    public Employee? Employee { get; set; }
    public List<OrderDetail> OrderDetails { get; set; } = [];
}

public class OrderDetail
{
    public int OrderID { get; set; }
    public int ProductID { get; set; }
    [Precision(19, 4)] public decimal UnitPrice { get; set; }
    public short Quantity { get; set; }
    public float Discount { get; set; }
    public Order? Order { get; set; }
    public Product? Product { get; set; }
}

public class NorthwindDb(DbContextOptions<NorthwindDb> o) : DbContext(o)
{
    public DbSet<Category> Categories => Set<Category>();
    public DbSet<Supplier> Suppliers => Set<Supplier>();
    public DbSet<Product> Products => Set<Product>();
    public DbSet<Customer> Customers => Set<Customer>();
    public DbSet<Employee> Employees => Set<Employee>();
    public DbSet<Order> Orders => Set<Order>();
    public DbSet<OrderDetail> OrderDetails => Set<OrderDetail>();

    public static readonly Dictionary<string, Type> EdmBindings = new()
    {
        ["NorthwindLike.Category"] = typeof(Category),
        ["NorthwindLike.Supplier"] = typeof(Supplier),
        ["NorthwindLike.Product"] = typeof(Product),
        ["NorthwindLike.Customer"] = typeof(Customer),
        ["NorthwindLike.Employee"] = typeof(Employee),
        ["NorthwindLike.Order"] = typeof(Order),
        ["NorthwindLike.OrderDetail"] = typeof(OrderDetail),
    };

    protected override void OnModelCreating(ModelBuilder mb)
    {
        mb.Entity<Category>(e => { e.ToTable("Categories"); e.HasKey(x => x.CategoryID); e.Property(x => x.CategoryID).ValueGeneratedNever(); });
        mb.Entity<Supplier>(e => { e.ToTable("Suppliers"); e.HasKey(x => x.SupplierID); e.Property(x => x.SupplierID).ValueGeneratedNever(); });
        mb.Entity<Customer>(e => { e.ToTable("Customers"); e.HasKey(x => x.CustomerID); });
        mb.Entity<Employee>(e => { e.ToTable("Employees"); e.HasKey(x => x.EmployeeID); e.Property(x => x.EmployeeID).ValueGeneratedNever(); });
        mb.Entity<Product>(e =>
        {
            e.ToTable("Products"); e.HasKey(x => x.ProductID); e.Property(x => x.ProductID).ValueGeneratedNever();
            e.HasOne(x => x.Category).WithMany(x => x.Products).HasForeignKey(x => x.CategoryID);
            e.HasOne(x => x.Supplier).WithMany(x => x.Products).HasForeignKey(x => x.SupplierID);
        });
        mb.Entity<Order>(e =>
        {
            e.ToTable("Orders"); e.HasKey(x => x.OrderID); e.Property(x => x.OrderID).ValueGeneratedNever();
            e.HasOne(x => x.Customer).WithMany(x => x.Orders).HasForeignKey(x => x.CustomerID);
            e.HasOne(x => x.Employee).WithMany(x => x.Orders).HasForeignKey(x => x.EmployeeID);
            e.HasIndex(x => x.OrderDate);
        });
        mb.Entity<OrderDetail>(e =>
        {
            e.ToTable("OrderDetails"); e.HasKey(x => new { x.OrderID, x.ProductID });
            e.HasOne(x => x.Order).WithMany(x => x.OrderDetails).HasForeignKey(x => x.OrderID);
            e.HasOne(x => x.Product).WithMany(x => x.OrderDetails).HasForeignKey(x => x.ProductID);
        });
        DbConventions.Apply(mb);
    }
}

public static class NorthwindSeeder
{
    static readonly (string Name, string Desc, string[] Nouns, string Unit)[] Cats =
    [
        ("Bakery", "Breads, rolls and baked goods", ["Rye Loaf", "Seed Roll", "Oat Biscuit", "Honey Cake", "Butter Croissant", "Spelt Bread"], "12 pieces"),
        ("Dairy", "Milk, cheese and yoghurt", ["Mountain Cheese", "Cream Yoghurt", "Goat Milk", "Smoked Gouda", "Fresh Butter"], "1 kg"),
        ("Produce", "Fruit and vegetables", ["Green Apples", "Sweet Pears", "Cherry Tomatoes", "Baby Carrots", "Red Onions"], "5 kg box"),
        ("Snacks", "Chips, nuts and bars", ["Sea Salt Chips", "Roasted Almonds", "Granola Bar", "Pretzel Sticks", "Trail Mix"], "24 bags"),
        ("Drinks", "Juices, waters and teas", ["Lemon Soda", "Mint Tea", "Ginger Ale", "Sparkling Water", "Apple Juice"], "12 bottles"),
        ("Frozen", "Frozen meals and desserts", ["Berry Sorbet", "Veggie Pizza", "Fish Fingers", "Pea Soup", "Vanilla Ice"], "10 packs"),
        ("Pantry", "Oils, sauces, grains and spices", ["Olive Oil", "Tomato Sauce", "Basmati Rice", "Chili Flakes", "Wheat Flour"], "6 jars"),
        ("Household", "Cleaning and paper goods", ["Dish Soap", "Paper Towels", "Glass Cleaner", "Sponge Pack", "Trash Bags"], "20 units"),
    ];
    static readonly string[] Adjectives = ["Classic", "Organic", "Premium", "Golden", "Rustic", "Alpine", "Coastal", "Harvest", "Northern", "Daily"];
    static readonly string[] Titles = ["Sales Representative", "Sales Manager", "Inside Sales Coordinator", "Account Executive"];

    public static void Create(string path)
    {
        var fake = new Fake(20261114);
        var opts = new DbContextOptionsBuilder<NorthwindDb>().UseSqlite($"Data Source={path};Pooling=False").Options;
        using var db = new NorthwindDb(opts);
        db.Database.EnsureCreated();

        var cats = Cats.Select((c, i) => new Category { CategoryID = i + 1, CategoryName = c.Name, Description = c.Desc }).ToList();
        var sups = Enumerable.Range(1, 30).Select(i => { var (co, ci) = fake.Place(); return new Supplier { SupplierID = i, CompanyName = fake.CompanyName(), ContactName = fake.PersonName(), City = ci, Country = co, Phone = fake.Phone() }; }).ToList();
        var names = new HashSet<string>();
        var prods = new List<Product>();
        for (var i = 1; i <= 500; i++)
        {
            var ci = fake.R.Next(Cats.Length);
            string name;
            do name = $"{fake.Pick(Adjectives)} {fake.Pick(Cats[ci].Nouns)} {fake.Word()}"; while (!names.Add(name));
            prods.Add(new Product
            {
                ProductID = i, ProductName = name, CategoryID = ci + 1, SupplierID = fake.Between(1, 30),
                QuantityPerUnit = Cats[ci].Unit, UnitPrice = fake.Dec(1.5, 120, 2) + 0.0000m,
                UnitsInStock = (short)fake.Between(0, 150), UnitsOnOrder = (short)(fake.Chance(0.3) ? fake.Between(5, 80) : 0),
                ReorderLevel = (short)(fake.Between(0, 6) * 5), Discontinued = fake.Chance(0.08),
            });
        }
        var custs = new List<Customer>();
        var codes = new HashSet<string>();
        while (custs.Count < 90)
        {
            var code = new string(Enumerable.Range(0, 5).Select(_ => (char)('A' + fake.R.Next(26))).ToArray());
            if (!codes.Add(code)) continue;
            var (co, ci) = fake.Place();
            custs.Add(new Customer { CustomerID = code, CompanyName = fake.CompanyName(), ContactName = fake.PersonName(), City = ci, Country = co, Phone = fake.Phone() });
        }
        var emps = Enumerable.Range(1, 9).Select(i => { var (co, ci) = fake.Place(); return new Employee { EmployeeID = i, FirstName = fake.FirstName(), LastName = fake.LastName(), Title = fake.Pick(Titles), HireDate = new DateOnly(2015, 1, 1).AddDays(fake.R.Next(3000)), City = ci, Country = co }; }).ToList();
        var orders = new List<Order>();
        var details = new List<OrderDetail>();
        var start = new DateTimeOffset(2023, 1, 1, 0, 0, 0, TimeSpan.Zero);
        for (var i = 0; i < 5000; i++)
        {
            var od = start.AddMinutes(fake.R.Next(60 * 24 * 1400));
            var day = DateOnly.FromDateTime(od.UtcDateTime);
            var cu = fake.Pick(custs);
            var o = new Order
            {
                OrderID = 20001 + i, CustomerID = cu.CustomerID, EmployeeID = fake.Between(1, 9), OrderDate = od,
                RequiredDate = day.AddDays(fake.Between(14, 42)), ShippedDate = fake.Chance(0.92) ? day.AddDays(fake.Between(1, 20)) : null,
                Freight = fake.Dec(0.5, 400, 2) + 0.0000m, ShipCity = cu.City, ShipCountry = cu.Country,
            };
            orders.Add(o);
            var n = fake.Weighted((1, 2), (2, 3), (3, 4), (4, 3), (5, 2));
            foreach (var p in Enumerable.Range(0, n).Select(_ => fake.Pick(prods)).DistinctBy(p => p.ProductID))
                details.Add(new OrderDetail { OrderID = o.OrderID, ProductID = p.ProductID, UnitPrice = p.UnitPrice!.Value, Quantity = (short)fake.Between(1, 60), Discount = fake.Pick(new[] { 0f, 0f, 0f, 0.05f, 0.1f, 0.15f }) });
        }

        var conn = (SqliteConnection)db.Database.GetDbConnection();
        conn.Open();
        using var tx = conn.BeginTransaction();
        BulkInsert.Insert(db, conn, tx, cats);
        BulkInsert.Insert(db, conn, tx, sups);
        BulkInsert.Insert(db, conn, tx, prods);
        BulkInsert.Insert(db, conn, tx, custs);
        BulkInsert.Insert(db, conn, tx, emps);
        BulkInsert.Insert(db, conn, tx, orders);
        BulkInsert.Insert(db, conn, tx, details);
        tx.Commit();
        conn.Close();
    }
}
