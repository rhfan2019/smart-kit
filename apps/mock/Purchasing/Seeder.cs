using Microsoft.Data.Sqlite;
using Microsoft.EntityFrameworkCore;
using Mock.Infrastructure;

namespace Mock.Purchasing;

/// <summary>Deterministic invented purchasing data (fixed seed). Free text is English only.</summary>
public static class PurchasingSeeder
{
    public static readonly DateOnly Today = new(2026, 11, 14);

    // Code, English, Chinese, criticality (0 neutral, 1 negative, 2 critical, 3 positive, 5 information)
    public static readonly (string Code, string En, string Zh, byte Crit)[] Statuses =
    [
        ("NEW", "New", "新建", 0),
        ("APPR", "Approved", "已审批", 3),
        ("ORD", "Ordered", "已下单", 5),
        ("PART", "Partially Delivered", "部分交货", 2),
        ("CLOSED", "Closed", "已关闭", 3),
    ];
    public static readonly (string Code, string En, string Zh)[] OrderTypes =
    [
        ("NB", "Standard Order", "标准采购订单"),
        ("FO", "Framework Order", "框架订单"),
        ("UB", "Stock Transport Order", "库存转储订单"),
    ];
    public static readonly (string Code, string En, string Zh)[] ConditionTypes =
    [
        ("PBXX", "Gross Price", "基础价"),
        ("RA01", "Discount", "折扣"),
        ("FRA1", "Freight", "运费"),
        ("ZSUR", "Surcharge", "附加费"),
    ];
    public static readonly (string Code, string En, string Zh)[] HistoryCategories =
    [
        ("GR", "Goods Receipt", "收货"),
        ("IR", "Invoice Receipt", "发票"),
    ];
    // Company code, currency, plant cities
    static readonly (string Code, string Currency, string[] Cities)[] Companies =
    [
        ("1000", "EUR", ["Hamburg", "Munich", "Cologne"]),
        ("2000", "USD", ["Chicago", "Denver", "Austin"]),
        ("3000", "CNY", ["Shanghai", "Suzhou", "Chengdu"]),
        ("4000", "JPY", ["Osaka", "Nagoya", "Yokohama"]),
    ];
    static readonly Dictionary<string, decimal> FxFromEur = new() { ["EUR"] = 1m, ["USD"] = 1.1m, ["CNY"] = 7.8m, ["JPY"] = 160m };

    static readonly string[] MatBase = ["Steel", "Stainless", "Aluminium", "Brass", "Copper", "Nylon", "PVC", "Rubber", "Oak", "Glass", "Ceramic", "Carbon"];
    static readonly (string Name, string Group, string Unit)[] MatItems =
    [
        ("Hex Bolt", "MECH", "EA"), ("Washer", "MECH", "EA"), ("Bracket", "MECH", "EA"), ("Hinge", "MECH", "EA"),
        ("Pipe", "RAW", "M"), ("Cable", "ELEC", "M"), ("Gasket", "MECH", "EA"), ("Bearing", "MECH", "EA"),
        ("Panel", "RAW", "EA"), ("Sheet", "RAW", "KG"), ("Valve", "MECH", "EA"), ("Spring", "MECH", "EA"),
        ("Filter", "CONS", "EA"), ("Connector", "ELEC", "EA"), ("Housing", "MECH", "EA"), ("Granulate", "RAW", "KG"),
        ("Coolant", "CONS", "L"), ("Lubricant", "CONS", "L"), ("Carton", "PACK", "EA"), ("Stretch Film", "PACK", "M"),
    ];
    static readonly string[] MatSpecs = ["M6", "M8", "M10", "M12", "10 mm", "25 mm", "40 mm", "Type A", "Type B", "Type C", "Grade 2", "Grade 5", "XL", "DN50", "DN80", "Heavy Duty", "Light"];

    static readonly string[] DescWhat = ["fasteners", "spare parts", "packaging material", "raw material", "electrical components", "consumables", "tooling", "maintenance supplies", "cabling", "bearings"];
    static readonly string[] DescFor = ["line 1", "line 2", "line 3", "the paint shop", "the warehouse", "the assembly hall", "the pilot project", "the service team", "the prototype build"];
    static readonly string[] NoteLines =
    [
        "Deliver to gate 4 between 7:00 and 15:00.", "Call the receiving desk one day before arrival.", "Partial deliveries are accepted.",
        "Quality certificate required with each shipment.", "Use reusable pallets where possible.", "Price agreed in the annual negotiation.",
        "Urgent: production depends on this order.", "Invoice must reference the purchase order number.", "Packaging must be moisture-proof.",
        "Supplier confirmed the dates by phone.", "Combine with the next scheduled shipment.", "Label every box with the material number.",
    ];

    public static void Create(string path)
    {
        var fake = new Fake(20261114);
        var opts = new DbContextOptionsBuilder<PurchasingDb>()
            .UseSqlite($"Data Source={path};Pooling=False")
            .ReplaceService<Microsoft.EntityFrameworkCore.Infrastructure.IModelCacheKeyFactory, LangModelCacheKeyFactory>()
            .Options;
        using var db = new PurchasingDb(opts, new Lang("en"));
        db.Database.EnsureCreated();

        var statuses = Statuses.Select(s => new OrderStatusEntity { Code = s.Code, Name = s.En, NameZh = s.Zh, Criticality = s.Crit }).ToList();
        var types = OrderTypes.Select(s => new OrderTypeEntity { Code = s.Code, Name = s.En, NameZh = s.Zh }).ToList();

        var supplierNames = new HashSet<string>();
        var suppliers = new List<SupplierEntity>();
        for (var i = 1; i <= 200; i++)
        {
            string name;
            do name = fake.CompanyName(); while (!supplierNames.Add(name));
            var (country, city) = fake.Place();
            var id = (100000 + i).ToString("D10");
            suppliers.Add(new SupplierEntity
            {
                Supplier = id, SupplierName = name, Country = country, City = city,
                Rating = DbConventions.Fix((decimal)Math.Round(1.5 + fake.R.NextDouble() * 3.5, 1), 1),
                LogoUrl = $"/media/suppliers/{id}.svg", IsBlocked = fake.Chance(0.05),
            });
        }

        var matNames = new HashSet<string>();
        var materials = new List<(MaterialEntity M, decimal PriceEur)>();
        for (var i = 1; i <= 500; i++)
        {
            var item = fake.Pick(MatItems);
            string name;
            do name = $"{fake.Pick(MatBase)} {item.Name} {fake.Pick(MatSpecs)}"; while (!matNames.Add(name));
            materials.Add((new MaterialEntity { Material = $"MAT-{10000 + i}", MaterialName = name, MaterialGroup = item.Group, BaseUnit = item.Unit },
                fake.Dec(0.2, item.Unit == "EA" ? 400 : 60, 2)));
        }

        var plants = new List<PlantEntity>();
        foreach (var (cc, _, cities) in Companies)
            for (var j = 0; j < 3; j++)
                plants.Add(new PlantEntity { Plant = $"{cc[0]}0{j + 1}0", PlantName = $"{cities[j]} {fake.Pick(new[] { "Plant", "Works", "Assembly", "Distribution Center" })}", City = cities[j] });

        var pos = new List<PurchaseOrderEntity>();
        var items = new List<PurchaseOrderItemEntity>();
        var conds = new List<PricingConditionEntity>();
        var hist = new List<ItemHistoryEntity>();
        long grDoc = 5000000000, irDoc = 5105000000;
        var start = new DateOnly(2024, 1, 1);
        var span = Today.DayNumber - start.DayNumber - 4;

        for (var n = 1; n <= 10000; n++)
        {
            var first = n == 1;
            var company = first ? Companies[0] : fake.Weighted((Companies[0], 55), (Companies[1], 20), (Companies[2], 15), (Companies[3], 10));
            var orderDate = first ? new DateOnly(2026, 10, 2) : start.AddDays(fake.R.Next(span));
            var age = Today.DayNumber - orderDate.DayNumber;
            var status = first ? "PART"
                : age > 150 ? fake.Weighted(("CLOSED", 80), ("PART", 12), ("ORD", 8))
                : fake.Weighted(("NEW", 15), ("APPR", 20), ("ORD", 30), ("PART", 20), ("CLOSED", 15));
            // mostly the company code currency, some orders in a foreign currency (EUR/USD)
            var currency = first || !fake.Chance(0.12) ? company.Currency : company.Currency == "USD" ? "EUR" : "USD";
            var curScale = currency == "JPY" ? 0 : 2;
            var po = new PurchaseOrderEntity
            {
                PurchaseOrder = (4500000000L + n).ToString(),
                PurchaseOrderType = first ? "NB" : fake.Weighted(("NB", 75), ("FO", 15), ("UB", 10)),
                Supplier = first ? suppliers[0].Supplier : fake.Pick(suppliers).Supplier,
                CompanyCode = company.Code,
                PurchasingGroup = $"P0{fake.Between(1, 8)}",
                OrderDate = orderDate,
                CreatedAt = new DateTimeOffset(orderDate.AddDays(-fake.Between(0, 2)).ToDateTime(new TimeOnly(fake.Between(6, 18), fake.Between(0, 59), fake.Between(0, 59))), TimeSpan.Zero),
                Status = status,
                Currency = currency,
                Description = first ? "Framework call-off for line 3 maintenance" : Describe(fake, orderDate),
                Notes = fake.Chance(0.4) ? null : string.Join("\n", Enumerable.Range(0, fake.Between(1, 3)).Select(_ => fake.Pick(NoteLines)).Distinct()),
                Version = 1,
            };
            var plantsOfCompany = plants.Where(p => p.Plant[0] == company.Code[0]).ToList();
            var itemCount = first ? 150 : fake.Weighted((1, 20), (2, 25), (3, 25), (4, 15), (5, 15));
            decimal ordered = 0, received = 0, poNet = 0;
            var minDelivery = DateOnly.MaxValue;
            for (var k = 1; k <= itemCount; k++)
            {
                var (mat, priceEur) = fake.Pick(materials);
                var qty = mat.BaseUnit == "EA" ? DbConventions.Fix(fake.Between(1, 500), 3) : fake.Dec(0.5, 2000, 3);
                var gross = DbConventions.Fix(priceEur * FxFromEur[currency], curScale) + 0.00m;
                if (gross == 0) gross = currency == "JPY" ? 1.00m : 0.01m;
                var it = new PurchaseOrderItemEntity
                {
                    PurchaseOrder = po.PurchaseOrder, PurchaseOrderItem = k * 10, Material = mat.Material,
                    Plant = fake.Pick(plantsOfCompany).Plant, OrderQuantity = qty, OrderUnit = mat.BaseUnit,
                    Currency = currency, DeliveryDate = orderDate.AddDays(fake.Between(7, 60)), Version = 1,
                };
                // pricing conditions: base price + 1..3 of discount / freight / surcharge
                var counter = 0;
                decimal net = 0;
                void Cond(string type, decimal rate, string rateUnit, decimal amount, bool statistical)
                {
                    var ct = ConditionTypes.First(c => c.Code == type);
                    amount = DbConventions.Fix(amount, curScale) + 0.00m;
                    conds.Add(new PricingConditionEntity
                    {
                        PurchaseOrder = it.PurchaseOrder, PurchaseOrderItem = it.PurchaseOrderItem, ConditionCounter = ++counter,
                        ConditionType = type, ConditionTypeName = ct.En, ConditionTypeNameZh = ct.Zh,
                        Rate = DbConventions.Fix(rate, 2), RateUnit = rateUnit, ConditionAmount = amount, Currency = currency, IsStatistical = statistical,
                    });
                    if (!statistical) net += amount;
                }
                var baseAmount = qty * gross;
                Cond("PBXX", gross, currency, baseAmount, false);
                var extras = new List<string>();
                if (fake.Chance(0.55)) extras.Add("RA01");
                if (fake.Chance(0.45)) extras.Add("FRA1");
                if (fake.Chance(0.3)) extras.Add("ZSUR");
                if (extras.Count == 0) extras.Add(fake.Pick(new[] { "RA01", "FRA1", "ZSUR" }));
                foreach (var x in extras)
                {
                    switch (x)
                    {
                        case "RA01": { var pct = (decimal)fake.Pick(new[] { 2, 3, 5, 8, 10 }); Cond(x, -pct, "%", -baseAmount * pct / 100, false); break; }
                        case "FRA1": { var f = DbConventions.Fix(fake.Between(10, 200) * FxFromEur[currency], curScale); Cond(x, f, currency, f, fake.Chance(0.3)); break; }
                        case "ZSUR": { var pct = 1.5m; Cond(x, pct, "%", baseAmount * pct / 100, false); break; }
                    }
                }
                it.NetAmount = DbConventions.Fix(net, 2);
                it.NetPrice = DbConventions.Fix(net / qty, 2);

                // history: goods receipts and invoices according to the header status
                var frac = status == "CLOSED" ? 1m : status == "PART" ? (decimal)fake.Pick(new[] { 0.0, 0.25, 0.5, 0.75, 1.0 }) : 0m;
                if (first && k == 1) frac = 0.5m;
                var recQty = qty * frac;
                if (mat.BaseUnit == "EA") recQty = Math.Floor(recQty);
                var hc = 0;
                decimal recSum = 0, invSum = 0;
                if (recQty > 0)
                {
                    var parts = recQty >= 2 && fake.Chance(0.4) ? 2 : 1;
                    var firstPart = parts == 2 ? (mat.BaseUnit == "EA" ? Math.Floor(recQty / 2) : decimal.Round(recQty / 2, 3)) : recQty;
                    foreach (var q in parts == 2 ? new[] { firstPart, recQty - firstPart } : new[] { recQty })
                    {
                        var hcText = HistoryCategories[0];
                        hist.Add(new ItemHistoryEntity
                        {
                            PurchaseOrder = it.PurchaseOrder, PurchaseOrderItem = it.PurchaseOrderItem, HistoryCounter = ++hc,
                            Category = "GR", CategoryText = hcText.En, CategoryTextZh = hcText.Zh, DocumentNumber = (++grDoc).ToString(),
                            PostingDate = Min(it.DeliveryDate.AddDays(fake.Between(-3, 5) + hc * 3), Today), Quantity = DbConventions.Fix(q, 3), Unit = it.OrderUnit,
                            Amount = DbConventions.Fix(q * it.NetPrice, 2), Currency = currency, MovementType = "101",
                        });
                        recSum += q;
                    }
                    if (status == "CLOSED" || fake.Chance(0.5))
                    {
                        var inv = DbConventions.Fix(status == "CLOSED" ? it.NetAmount : recSum * it.NetPrice, 2);
                        var irText = HistoryCategories[1];
                        hist.Add(new ItemHistoryEntity
                        {
                            PurchaseOrder = it.PurchaseOrder, PurchaseOrderItem = it.PurchaseOrderItem, HistoryCounter = ++hc,
                            Category = "IR", CategoryText = irText.En, CategoryTextZh = irText.Zh, DocumentNumber = (++irDoc).ToString(),
                            PostingDate = Min(it.DeliveryDate.AddDays(fake.Between(5, 25)), Today), Quantity = DbConventions.Fix(recSum, 3), Unit = it.OrderUnit,
                            Amount = inv, Currency = currency, MovementType = null,
                        });
                        invSum += inv;
                    }
                }
                it.ReceivedQuantity = DbConventions.Fix(recSum, 3);
                it.InvoicedAmount = DbConventions.Fix(invSum, 2);
                ordered += qty; received += recSum; poNet += it.NetAmount;
                if (it.DeliveryDate < minDelivery) minDelivery = it.DeliveryDate;
                items.Add(it);
            }
            po.NetAmount = DbConventions.Fix(poNet, 2);
            po.DeliveredPercent = status == "CLOSED" ? 100.0m : DbConventions.Fix(ordered == 0 ? 0 : received * 100 / ordered, 1);
            if (status == "PART" && po.DeliveredPercent is 0m or 100m) po.DeliveredPercent = 50.0m;
            var crit = Statuses.First(s => s.Code == status).Crit;
            if (status is "ORD" or "PART" && minDelivery < Today) crit = 1; // overdue
            po.StatusCriticality = crit;
            pos.Add(po);
        }

        var conn = (SqliteConnection)db.Database.GetDbConnection();
        conn.Open();
        using (var pragma = conn.CreateCommand()) { pragma.CommandText = "PRAGMA synchronous=OFF; PRAGMA journal_mode=MEMORY;"; pragma.ExecuteNonQuery(); }
        using var tx = conn.BeginTransaction();
        BulkInsert.Insert(db, conn, tx, statuses);
        BulkInsert.Insert(db, conn, tx, types);
        BulkInsert.Insert(db, conn, tx, suppliers);
        BulkInsert.Insert(db, conn, tx, materials.Select(m => m.M));
        BulkInsert.Insert(db, conn, tx, plants);
        BulkInsert.Insert(db, conn, tx, pos);
        BulkInsert.Insert(db, conn, tx, items);
        BulkInsert.Insert(db, conn, tx, conds);
        BulkInsert.Insert(db, conn, tx, hist);
        tx.Commit();
        using (var an = conn.CreateCommand()) { an.CommandText = "ANALYZE;"; an.ExecuteNonQuery(); }
        conn.Close();
    }

    static string Cap(string s) => char.ToUpperInvariant(s[0]) + s[1..];
    static DateOnly Min(DateOnly a, DateOnly b) => a < b ? a : b;

    static string Describe(Fake f, DateOnly d) => f.R.Next(4) switch
    {
        0 => $"Replenishment of {f.Pick(DescWhat)} for {f.Pick(DescFor)}",
        1 => Cap(f.Pick(DescWhat)) + $" Q{(d.Month - 1) / 3 + 1} {d.Year}",
        2 => $"Spare stock of {f.Pick(DescWhat)}",
        _ => $"Order for {f.Pick(DescFor)}: {f.Pick(DescWhat)}",
    };
}
