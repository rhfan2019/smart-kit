using Microsoft.EntityFrameworkCore;
using Mock.Infrastructure;

namespace Mock.Purchasing;

// CLR classes carry an "Entity" suffix because C# forbids a member named like its type
// (EDM type Purchasing.PurchaseOrder has a property PurchaseOrder). Properties named *En / *Zh
// are storage-only (not in the EDM); the EF model maps the localized property (e.g. Name) to the
// column of the request language, see PurchasingDb.

public class PurchaseOrderEntity
{
    public string PurchaseOrder { get; set; } = "";
    public string PurchaseOrderType { get; set; } = "";
    public string Supplier { get; set; } = "";
    public string CompanyCode { get; set; } = "";
    public string PurchasingGroup { get; set; } = "";
    public DateOnly OrderDate { get; set; }
    public DateTimeOffset CreatedAt { get; set; }
    public string Status { get; set; } = "";
    public byte StatusCriticality { get; set; }
    [Precision(15, 2)] public decimal NetAmount { get; set; }
    public string Currency { get; set; } = "";
    [Precision(4, 1)] public decimal DeliveredPercent { get; set; }
    public string? Description { get; set; }
    public string? Notes { get; set; }
    public int Version { get; set; }
    public SupplierEntity? _Supplier { get; set; }
    public OrderStatusEntity? _Status { get; set; }
    public OrderTypeEntity? _PurchaseOrderType { get; set; }
    public List<PurchaseOrderItemEntity> _Item { get; set; } = [];
}

public class PurchaseOrderItemEntity
{
    public string PurchaseOrder { get; set; } = "";
    public int PurchaseOrderItem { get; set; }
    public string Material { get; set; } = "";
    public string Plant { get; set; } = "";
    [Precision(13, 3)] public decimal OrderQuantity { get; set; }
    public string OrderUnit { get; set; } = "";
    [Precision(11, 2)] public decimal NetPrice { get; set; }
    [Precision(15, 2)] public decimal NetAmount { get; set; }
    public string Currency { get; set; } = "";
    public DateOnly DeliveryDate { get; set; }
    [Precision(13, 3)] public decimal ReceivedQuantity { get; set; }
    [Precision(15, 2)] public decimal InvoicedAmount { get; set; }
    public int Version { get; set; }
    public PurchaseOrderEntity? _PurchaseOrder { get; set; }
    public MaterialEntity? _Material { get; set; }
    public PlantEntity? _Plant { get; set; }
    public List<PricingConditionEntity> _PricingCondition { get; set; } = [];
    public List<ItemHistoryEntity> _History { get; set; } = [];
}

public class PricingConditionEntity
{
    public string PurchaseOrder { get; set; } = "";
    public int PurchaseOrderItem { get; set; }
    public int ConditionCounter { get; set; }
    public string ConditionType { get; set; } = "";
    public string ConditionTypeName { get; set; } = "";
    public string ConditionTypeNameEn { get; set; } = "";
    public string ConditionTypeNameZh { get; set; } = "";
    [Precision(11, 2)] public decimal Rate { get; set; }
    public string RateUnit { get; set; } = "";
    [Precision(15, 2)] public decimal ConditionAmount { get; set; }
    public string Currency { get; set; } = "";
    public bool IsStatistical { get; set; }
    public PurchaseOrderItemEntity? _Item { get; set; }
}

public class ItemHistoryEntity
{
    public string PurchaseOrder { get; set; } = "";
    public int PurchaseOrderItem { get; set; }
    public int HistoryCounter { get; set; }
    public string Category { get; set; } = "";
    public string CategoryText { get; set; } = "";
    public string CategoryTextEn { get; set; } = "";
    public string CategoryTextZh { get; set; } = "";
    public string DocumentNumber { get; set; } = "";
    public DateOnly PostingDate { get; set; }
    [Precision(13, 3)] public decimal Quantity { get; set; }
    public string Unit { get; set; } = "";
    [Precision(15, 2)] public decimal Amount { get; set; }
    public string Currency { get; set; } = "";
    public string? MovementType { get; set; }
    public PurchaseOrderItemEntity? _Item { get; set; }
}

public class SupplierEntity
{
    public string Supplier { get; set; } = "";
    public string SupplierName { get; set; } = "";
    public string Country { get; set; } = "";
    public string City { get; set; } = "";
    [Precision(2, 1)] public decimal Rating { get; set; }
    public string LogoUrl { get; set; } = "";
    public bool IsBlocked { get; set; }
}

public class MaterialEntity
{
    public string Material { get; set; } = "";
    public string MaterialName { get; set; } = "";
    public string MaterialGroup { get; set; } = "";
    public string BaseUnit { get; set; } = "";
}

public class PlantEntity
{
    public string Plant { get; set; } = "";
    public string PlantName { get; set; } = "";
    public string City { get; set; } = "";
}

public class OrderStatusEntity
{
    public string Code { get; set; } = "";
    public string Name { get; set; } = "";
    public string NameEn { get; set; } = "";
    public string NameZh { get; set; } = "";
    public byte Criticality { get; set; }
}

public class OrderTypeEntity
{
    public string Code { get; set; } = "";
    public string Name { get; set; } = "";
    public string NameEn { get; set; } = "";
    public string NameZh { get; set; } = "";
}

public class VariantEntity
{
    public Guid ID { get; set; }
    public string PageKey { get; set; } = "";
    public string Name { get; set; } = "";
    public bool IsDefault { get; set; }
    public bool AutoApply { get; set; }
    public string Content { get; set; } = "";
    public DateTimeOffset ModifiedAt { get; set; }
}

public class PurchasingDb : DbContext, ILangContext
{
    public PurchasingDb(DbContextOptions<PurchasingDb> o, Lang lang) : base(o) => LangCode = lang.Code;
    public string LangCode { get; }

    public DbSet<PurchaseOrderEntity> PurchaseOrders => Set<PurchaseOrderEntity>();
    public DbSet<PurchaseOrderItemEntity> PurchaseOrderItems => Set<PurchaseOrderItemEntity>();
    public DbSet<PricingConditionEntity> PricingConditions => Set<PricingConditionEntity>();
    public DbSet<ItemHistoryEntity> ItemHistory => Set<ItemHistoryEntity>();
    public DbSet<SupplierEntity> Suppliers => Set<SupplierEntity>();
    public DbSet<MaterialEntity> Materials => Set<MaterialEntity>();
    public DbSet<PlantEntity> Plants => Set<PlantEntity>();
    public DbSet<OrderStatusEntity> OrderStatuses => Set<OrderStatusEntity>();
    public DbSet<OrderTypeEntity> PurchaseOrderTypes => Set<OrderTypeEntity>();
    public DbSet<VariantEntity> Variants => Set<VariantEntity>();

    public static readonly Dictionary<string, Type> EdmBindings = new()
    {
        ["Purchasing.PurchaseOrder"] = typeof(PurchaseOrderEntity),
        ["Purchasing.PurchaseOrderItem"] = typeof(PurchaseOrderItemEntity),
        ["Purchasing.PricingCondition"] = typeof(PricingConditionEntity),
        ["Purchasing.ItemHistory"] = typeof(ItemHistoryEntity),
        ["Purchasing.Supplier"] = typeof(SupplierEntity),
        ["Purchasing.Material"] = typeof(MaterialEntity),
        ["Purchasing.Plant"] = typeof(PlantEntity),
        ["Purchasing.OrderStatus"] = typeof(OrderStatusEntity),
        ["Purchasing.OrderType"] = typeof(OrderTypeEntity),
        ["Purchasing.Variant"] = typeof(VariantEntity),
    };

    protected override void OnModelCreating(ModelBuilder mb)
    {
        var zh = LangCode == "zh";
        // Localized text: the EDM property maps to the column of the request language; the
        // other language's column is mapped through its storage-only property (so the schema is the same).
        void Loc<T>(Microsoft.EntityFrameworkCore.Metadata.Builders.EntityTypeBuilder<T> e, string prop) where T : class
        {
            e.Property<string>(prop).HasColumnName(prop + (zh ? "_zh" : "_en"));
            e.Property<string>(prop + (zh ? "En" : "Zh")).HasColumnName(prop + (zh ? "_en" : "_zh"));
            e.Ignore(prop + (zh ? "Zh" : "En"));
        }

        mb.Entity<SupplierEntity>(e => { e.ToTable("Suppliers"); e.HasKey(x => x.Supplier); e.HasIndex(x => x.SupplierName); });
        mb.Entity<MaterialEntity>(e => { e.ToTable("Materials"); e.HasKey(x => x.Material); });
        mb.Entity<PlantEntity>(e => { e.ToTable("Plants"); e.HasKey(x => x.Plant); });
        mb.Entity<OrderStatusEntity>(e => { e.ToTable("OrderStatuses"); e.HasKey(x => x.Code); Loc(e, "Name"); });
        mb.Entity<OrderTypeEntity>(e => { e.ToTable("PurchaseOrderTypes"); e.HasKey(x => x.Code); Loc(e, "Name"); });
        mb.Entity<VariantEntity>(e => { e.ToTable("Variants"); e.HasKey(x => x.ID); e.HasIndex(x => x.PageKey); });
        mb.Entity<PurchaseOrderEntity>(e =>
        {
            e.ToTable("PurchaseOrders"); e.HasKey(x => x.PurchaseOrder);
            e.HasOne(x => x._Supplier).WithMany().HasForeignKey(x => x.Supplier);
            e.HasOne(x => x._Status).WithMany().HasForeignKey(x => x.Status);
            e.HasOne(x => x._PurchaseOrderType).WithMany().HasForeignKey(x => x.PurchaseOrderType);
            e.HasMany(x => x._Item).WithOne(x => x._PurchaseOrder).HasForeignKey(x => x.PurchaseOrder);
            e.HasIndex(x => x.OrderDate); e.HasIndex(x => x.CompanyCode); e.HasIndex(x => x.NetAmount);
        });
        mb.Entity<PurchaseOrderItemEntity>(e =>
        {
            e.ToTable("PurchaseOrderItems"); e.HasKey(x => new { x.PurchaseOrder, x.PurchaseOrderItem });
            e.HasOne(x => x._Material).WithMany().HasForeignKey(x => x.Material);
            e.HasOne(x => x._Plant).WithMany().HasForeignKey(x => x.Plant);
            e.HasMany(x => x._PricingCondition).WithOne(x => x._Item).HasForeignKey(x => new { x.PurchaseOrder, x.PurchaseOrderItem });
            e.HasMany(x => x._History).WithOne(x => x._Item).HasForeignKey(x => new { x.PurchaseOrder, x.PurchaseOrderItem });
        });
        mb.Entity<PricingConditionEntity>(e =>
        {
            e.ToTable("PricingConditions"); e.HasKey(x => new { x.PurchaseOrder, x.PurchaseOrderItem, x.ConditionCounter });
            Loc(e, "ConditionTypeName");
        });
        mb.Entity<ItemHistoryEntity>(e =>
        {
            e.ToTable("ItemHistory"); e.HasKey(x => new { x.PurchaseOrder, x.PurchaseOrderItem, x.HistoryCounter });
            Loc(e, "CategoryText");
        });
        foreach (var et in mb.Model.GetEntityTypes())
        foreach (var p in et.GetProperties())
            if (p.ClrType == typeof(int) && !p.IsForeignKey()) p.ValueGenerated = Microsoft.EntityFrameworkCore.Metadata.ValueGenerated.Never;
        DbConventions.Apply(mb);
    }
}
