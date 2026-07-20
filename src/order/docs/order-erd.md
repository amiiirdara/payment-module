# Order Module — ERD

تولیدشده از روی دکوریتورهای TypeORM در `src/order/entities/` (به‌روز با کد فعلی).

```mermaid
erDiagram
    CarPartCategory ||--o{ DomainPaymentGatewayCatJoin : ""
    CarPartConfig ||--o{ CartItem : ""
    CarPartConfig ||--o{ OrderItem : ""
    CarPart ||--o{ OrderGovermentTires : ""
    Cart ||--o{ CartItem : ""
    Cart ||--o{ InstallationBooking : ""
    Discount ||--o{ Order : ""
    DomainPaymentGateway ||--o{ DomainPaymentGatewayCatJoin : ""
    OrderCancelDescription ||--|| Order : ""
    Order ||--|| AddressClone : ""
    Order ||--o{ InstallationReserve : ""
    Order ||--o{ ManualRefund : ""
    Order ||--o{ OrderEvent : ""
    Order ||--|| OrderExperiment : ""
    Order ||--o{ OrderGovermentTires : ""
    Order ||--o{ OrderItem : ""
    Order ||--o{ Parcel : ""
    Order ||--o{ Return : ""
    OrderItem ||--o{ PhysicalOrderItem : ""
    Parcel ||--o{ OrderEvent : ""
    Parcel ||--o{ OrderItem : ""
    Parcel ||--o{ PhysicalOrderItem : ""
    Parcel ||--o{ Shipping : ""
    Payment ||--o{ Order : ""
    Supplier ||--o{ Cart : ""
    Supplier ||--o{ OrderShipping : ""
    Supplier ||--o{ Parcel : ""
    User ||--o{ Cart : ""
    User ||--o{ Order : ""
    User ||--o{ OrderEvent : ""
    User ||--o{ OrderGovermentTires : ""
    User ||--o{ OrderItem : ""
```

**موجودیت‌های خارج از این ریپو** (فقط به‌عنوان مرجع در نمودار آمده‌اند): `AddressClone`، `CarPartCategory`، `CarPartConfig`، `CarPart`، `Discount`، `DomainPaymentGateway`، `InstallationBooking`، `InstallationReserve`، `Payment`، `PhysicalOrderItem`، `Return`، `Shipping`، `Supplier`، `User`
