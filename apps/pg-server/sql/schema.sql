-- Purchasing test bed on PostgreSQL (read by smart-kit-cli, served by smart-kit-server).
-- Same structure and data as the purchasing test service of apps/mock (seeded by setup.ts from the same generator).
-- Idempotent: only creates what is missing. Column comments become Common.Label in the generated CSDL.
-- Runs as the owner role inside the database smart_kit_purchasing; touches nothing outside schema "purchasing".

create schema if not exists purchasing;

create table if not exists purchasing.order_status (
  code        varchar(10) primary key,
  name        varchar(40) not null,
  criticality smallint    not null
);
comment on table purchasing.order_status is 'Status of a purchase order';
comment on column purchasing.order_status.code is 'Status';
comment on column purchasing.order_status.name is 'Status Name';
comment on column purchasing.order_status.criticality is 'Criticality';

create table if not exists purchasing.order_type (
  code varchar(4)  primary key,
  name varchar(40) not null
);
comment on table purchasing.order_type is 'Purchase order type';
comment on column purchasing.order_type.code is 'Order Type';
comment on column purchasing.order_type.name is 'Order Type Name';

create table if not exists purchasing.supplier (
  supplier      varchar(10)  primary key,
  supplier_name varchar(80)  not null,
  country       varchar(3)   not null,
  city          varchar(40)  not null,
  rating        numeric(2,1) not null,
  logo_url      varchar(255) not null,
  is_blocked    boolean      not null,
  rating_count  integer      not null
);
comment on column purchasing.supplier.supplier is 'Supplier';
comment on column purchasing.supplier.supplier_name is 'Supplier Name';
comment on column purchasing.supplier.country is 'Country';
comment on column purchasing.supplier.city is 'City';
comment on column purchasing.supplier.rating is 'Rating';
comment on column purchasing.supplier.logo_url is 'Logo';
comment on column purchasing.supplier.is_blocked is 'Blocked';
comment on column purchasing.supplier.rating_count is 'Number of Ratings';

create table if not exists purchasing.material (
  material       varchar(10) primary key,
  material_name  varchar(80) not null,
  material_group varchar(9)  not null,
  base_unit      varchar(3)  not null
);
comment on column purchasing.material.material is 'Material';
comment on column purchasing.material.material_name is 'Material Description';
comment on column purchasing.material.material_group is 'Material Group';
comment on column purchasing.material.base_unit is 'Base Unit';

create table if not exists purchasing.plant (
  plant      varchar(4)  primary key,
  plant_name varchar(40) not null,
  city       varchar(40) not null
);
comment on column purchasing.plant.plant is 'Plant';
comment on column purchasing.plant.plant_name is 'Plant Name';
comment on column purchasing.plant.city is 'City';

create table if not exists purchasing.purchase_order (
  purchase_order      varchar(10)    primary key,
  purchase_order_type varchar(4)     not null,
  supplier            varchar(10)    not null,
  company_code        varchar(4)     not null,
  purchasing_group    varchar(3)     not null,
  order_date          date           not null,
  created_at          timestamptz(0) not null,
  status              varchar(10)    not null,
  status_criticality  smallint       not null,
  net_amount          numeric(15,2)  not null,
  currency            varchar(3)     not null,
  delivered_percent   numeric(4,1)   not null,
  description         varchar(80),
  notes               varchar(1000),
  version             integer        not null,
  budget_amount       numeric(15,2)  not null,
  invoiced_amount     numeric(15,2)  not null,
  approve_enabled     boolean        not null,
  close_enabled       boolean        not null,
  constraint purchase_order_type_fk foreign key (purchase_order_type) references purchasing.order_type (code),
  constraint purchase_order_supplier_fk foreign key (supplier) references purchasing.supplier (supplier),
  constraint purchase_order_status_fk foreign key (status) references purchasing.order_status (code)
);
create index if not exists purchase_order_supplier_ix on purchasing.purchase_order (supplier);
create index if not exists purchase_order_status_ix on purchasing.purchase_order (status);
create index if not exists purchase_order_order_date_ix on purchasing.purchase_order (order_date);
create index if not exists purchase_order_company_code_ix on purchasing.purchase_order (company_code);
comment on table purchasing.purchase_order is 'Purchase order';
comment on column purchasing.purchase_order.purchase_order is 'Purchase Order';
comment on column purchasing.purchase_order.purchase_order_type is 'Order Type';
comment on column purchasing.purchase_order.supplier is 'Supplier';
comment on column purchasing.purchase_order.company_code is 'Company Code';
comment on column purchasing.purchase_order.purchasing_group is 'Purchasing Group';
comment on column purchasing.purchase_order.order_date is 'Order Date';
comment on column purchasing.purchase_order.created_at is 'Created On';
comment on column purchasing.purchase_order.status is 'Status';
comment on column purchasing.purchase_order.status_criticality is 'Status Criticality';
comment on column purchasing.purchase_order.net_amount is 'Net Amount';
comment on column purchasing.purchase_order.currency is 'Currency';
comment on column purchasing.purchase_order.delivered_percent is 'Delivered';
comment on column purchasing.purchase_order.description is 'Description';
comment on column purchasing.purchase_order.notes is 'Notes';
comment on column purchasing.purchase_order.version is 'Version';
comment on column purchasing.purchase_order.budget_amount is 'Budget';
comment on column purchasing.purchase_order.invoiced_amount is 'Invoiced Amount';
comment on column purchasing.purchase_order.approve_enabled is 'Approve Enabled';
comment on column purchasing.purchase_order.close_enabled is 'Close Enabled';

create table if not exists purchasing.purchase_order_item (
  purchase_order      varchar(10)   not null,
  purchase_order_item integer       not null,
  material            varchar(10)   not null,
  plant               varchar(4)    not null,
  order_quantity      numeric(13,3) not null,
  order_unit          varchar(3)    not null,
  net_price           numeric(11,2) not null,
  net_amount          numeric(15,2) not null,
  currency            varchar(3)    not null,
  delivery_date       date          not null,
  received_quantity   numeric(13,3) not null,
  invoiced_amount     numeric(15,2) not null,
  version             integer       not null,
  primary key (purchase_order, purchase_order_item),
  constraint purchase_order_item_order_fk foreign key (purchase_order) references purchasing.purchase_order (purchase_order),
  constraint purchase_order_item_material_fk foreign key (material) references purchasing.material (material),
  constraint purchase_order_item_plant_fk foreign key (plant) references purchasing.plant (plant)
);
create index if not exists purchase_order_item_material_ix on purchasing.purchase_order_item (material);
comment on table purchasing.purchase_order_item is 'Purchase order item';
comment on column purchasing.purchase_order_item.purchase_order is 'Purchase Order';
comment on column purchasing.purchase_order_item.purchase_order_item is 'Item';
comment on column purchasing.purchase_order_item.material is 'Material';
comment on column purchasing.purchase_order_item.plant is 'Plant';
comment on column purchasing.purchase_order_item.order_quantity is 'Order Quantity';
comment on column purchasing.purchase_order_item.order_unit is 'Order Unit';
comment on column purchasing.purchase_order_item.net_price is 'Net Price';
comment on column purchasing.purchase_order_item.net_amount is 'Net Amount';
comment on column purchasing.purchase_order_item.currency is 'Currency';
comment on column purchasing.purchase_order_item.delivery_date is 'Delivery Date';
comment on column purchasing.purchase_order_item.received_quantity is 'Received Quantity';
comment on column purchasing.purchase_order_item.invoiced_amount is 'Invoiced Amount';
comment on column purchasing.purchase_order_item.version is 'Version';

create table if not exists purchasing.pricing_condition (
  purchase_order      varchar(10)   not null,
  purchase_order_item integer       not null,
  condition_counter   integer       not null,
  condition_type      varchar(4)    not null,
  condition_type_name varchar(40)   not null,
  rate                numeric(11,2) not null,
  rate_unit           varchar(3)    not null,
  condition_amount    numeric(15,2) not null,
  currency            varchar(3)    not null,
  is_statistical      boolean       not null,
  primary key (purchase_order, purchase_order_item, condition_counter),
  constraint pricing_condition_item_fk foreign key (purchase_order, purchase_order_item) references purchasing.purchase_order_item (purchase_order, purchase_order_item)
);
comment on table purchasing.pricing_condition is 'Pricing condition of an item';
comment on column purchasing.pricing_condition.purchase_order is 'Purchase Order';
comment on column purchasing.pricing_condition.purchase_order_item is 'Item';
comment on column purchasing.pricing_condition.condition_counter is 'Step';
comment on column purchasing.pricing_condition.condition_type is 'Condition Type';
comment on column purchasing.pricing_condition.condition_type_name is 'Condition';
comment on column purchasing.pricing_condition.rate is 'Rate';
comment on column purchasing.pricing_condition.rate_unit is 'Rate Unit';
comment on column purchasing.pricing_condition.condition_amount is 'Amount';
comment on column purchasing.pricing_condition.currency is 'Currency';
comment on column purchasing.pricing_condition.is_statistical is 'Statistical';

create table if not exists purchasing.item_history (
  purchase_order      varchar(10)   not null,
  purchase_order_item integer       not null,
  history_counter     integer       not null,
  category            varchar(2)    not null,
  category_text       varchar(40)   not null,
  document_number     varchar(10)   not null,
  posting_date        date          not null,
  quantity            numeric(13,3) not null,
  unit                varchar(3)    not null,
  amount              numeric(15,2) not null,
  currency            varchar(3)    not null,
  movement_type       varchar(3),
  primary key (purchase_order, purchase_order_item, history_counter),
  constraint item_history_item_fk foreign key (purchase_order, purchase_order_item) references purchasing.purchase_order_item (purchase_order, purchase_order_item)
);
comment on table purchasing.item_history is 'Goods and invoice receipts of an item (series for the micro charts)';
comment on column purchasing.item_history.purchase_order is 'Purchase Order';
comment on column purchasing.item_history.purchase_order_item is 'Item';
comment on column purchasing.item_history.history_counter is 'Counter';
comment on column purchasing.item_history.category is 'Category';
comment on column purchasing.item_history.category_text is 'Category';
comment on column purchasing.item_history.document_number is 'Document';
comment on column purchasing.item_history.posting_date is 'Posting Date';
comment on column purchasing.item_history.quantity is 'Quantity';
comment on column purchasing.item_history.unit is 'Unit';
comment on column purchasing.item_history.amount is 'Amount';
comment on column purchasing.item_history.currency is 'Currency';
comment on column purchasing.item_history.movement_type is 'Movement Type';
