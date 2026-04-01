use starknet::ContractAddress;

#[starknet::interface]
pub trait ISpendingAnalytics<TContractState> {
    // Record (called by invoice registry on submit/approve/pay)
    fn record_submission(ref self: TContractState, employee: ContractAddress, vendor: felt252, amount_cents: u64, month: u32);
    fn record_approval(ref self: TContractState, employee: ContractAddress, vendor: felt252, amount_cents: u64, month: u32);
    fn record_payment(ref self: TContractState, employee: ContractAddress, vendor: felt252, amount_cents: u64, month: u32);
    fn record_rejection(ref self: TContractState, employee: ContractAddress, amount_cents: u64, month: u32);

    // Global analytics
    fn get_total_submitted(self: @TContractState) -> u64;
    fn get_total_approved(self: @TContractState) -> u64;
    fn get_total_paid(self: @TContractState) -> u64;
    fn get_total_rejected(self: @TContractState) -> u64;
    fn get_total_amount_submitted(self: @TContractState) -> u64;
    fn get_total_amount_paid(self: @TContractState) -> u64;

    // Per-month analytics
    fn get_month_submitted_count(self: @TContractState, month: u32) -> u64;
    fn get_month_submitted_amount(self: @TContractState, month: u32) -> u64;
    fn get_month_paid_count(self: @TContractState, month: u32) -> u64;
    fn get_month_paid_amount(self: @TContractState, month: u32) -> u64;

    // Per-employee analytics
    fn get_employee_total_submitted(self: @TContractState, employee: ContractAddress) -> u64;
    fn get_employee_total_paid(self: @TContractState, employee: ContractAddress) -> u64;
    fn get_employee_month_spend(self: @TContractState, employee: ContractAddress, month: u32) -> u64;

    // Per-vendor analytics
    fn get_vendor_total_invoices(self: @TContractState, vendor: felt252) -> u64;
    fn get_vendor_total_amount(self: @TContractState, vendor: felt252) -> u64;
    fn get_vendor_month_amount(self: @TContractState, vendor: felt252, month: u32) -> u64;

    fn set_authorized_caller(ref self: TContractState, caller: ContractAddress);
    fn get_admin(self: @TContractState) -> ContractAddress;
}

#[starknet::contract]
pub mod SpendingAnalytics {
    use starknet::{ContractAddress, get_caller_address};
    use starknet::storage::{Map, StoragePointerReadAccess, StoragePointerWriteAccess, StoragePathEntry};

    #[storage]
    struct Storage {
        admin: ContractAddress,
        authorized_caller: ContractAddress,
        // Global counters
        total_submitted: u64,
        total_approved: u64,
        total_paid: u64,
        total_rejected: u64,
        total_amount_submitted: u64,
        total_amount_paid: u64,
        // Per-month
        month_submitted_count: Map<u32, u64>,
        month_submitted_amount: Map<u32, u64>,
        month_paid_count: Map<u32, u64>,
        month_paid_amount: Map<u32, u64>,
        // Per-employee
        employee_total_submitted: Map<ContractAddress, u64>,
        employee_total_paid: Map<ContractAddress, u64>,
        employee_month_spend: Map<(ContractAddress, u32), u64>,
        // Per-vendor
        vendor_total_invoices: Map<felt252, u64>,
        vendor_total_amount: Map<felt252, u64>,
        vendor_month_amount: Map<(felt252, u32), u64>,
    }

    #[event]
    #[derive(Drop, starknet::Event)]
    pub enum Event {
        AnalyticsRecorded: AnalyticsRecorded,
    }

    #[derive(Drop, starknet::Event)]
    pub struct AnalyticsRecorded {
        pub event_type: felt252, // 'submit', 'approve', 'pay', 'reject'
        pub amount_cents: u64,
        pub month: u32,
    }

    #[constructor]
    fn constructor(ref self: ContractState, admin: ContractAddress) {
        self.admin.write(admin);
        self.total_submitted.write(0);
        self.total_approved.write(0);
        self.total_paid.write(0);
        self.total_rejected.write(0);
        self.total_amount_submitted.write(0);
        self.total_amount_paid.write(0);
    }

    #[abi(embed_v0)]
    impl SpendingAnalyticsImpl of super::ISpendingAnalytics<ContractState> {
        fn record_submission(
            ref self: ContractState,
            employee: ContractAddress,
            vendor: felt252,
            amount_cents: u64,
            month: u32,
        ) {
            self._assert_authorized();

            self.total_submitted.write(self.total_submitted.read() + 1);
            self.total_amount_submitted.write(self.total_amount_submitted.read() + amount_cents);

            let mc = self.month_submitted_count.entry(month).read();
            self.month_submitted_count.entry(month).write(mc + 1);
            let ma = self.month_submitted_amount.entry(month).read();
            self.month_submitted_amount.entry(month).write(ma + amount_cents);

            let es = self.employee_total_submitted.entry(employee).read();
            self.employee_total_submitted.entry(employee).write(es + 1);

            let vi = self.vendor_total_invoices.entry(vendor).read();
            self.vendor_total_invoices.entry(vendor).write(vi + 1);
            let va = self.vendor_total_amount.entry(vendor).read();
            self.vendor_total_amount.entry(vendor).write(va + amount_cents);
            let vma = self.vendor_month_amount.entry((vendor, month)).read();
            self.vendor_month_amount.entry((vendor, month)).write(vma + amount_cents);

            self.emit(AnalyticsRecorded { event_type: 'submit', amount_cents, month });
        }

        fn record_approval(
            ref self: ContractState,
            employee: ContractAddress,
            vendor: felt252,
            amount_cents: u64,
            month: u32,
        ) {
            self._assert_authorized();
            self.total_approved.write(self.total_approved.read() + 1);
            self.emit(AnalyticsRecorded { event_type: 'approve', amount_cents, month });
        }

        fn record_payment(
            ref self: ContractState,
            employee: ContractAddress,
            vendor: felt252,
            amount_cents: u64,
            month: u32,
        ) {
            self._assert_authorized();

            self.total_paid.write(self.total_paid.read() + 1);
            self.total_amount_paid.write(self.total_amount_paid.read() + amount_cents);

            let mpc = self.month_paid_count.entry(month).read();
            self.month_paid_count.entry(month).write(mpc + 1);
            let mpa = self.month_paid_amount.entry(month).read();
            self.month_paid_amount.entry(month).write(mpa + amount_cents);

            let ep = self.employee_total_paid.entry(employee).read();
            self.employee_total_paid.entry(employee).write(ep + 1);
            let ems = self.employee_month_spend.entry((employee, month)).read();
            self.employee_month_spend.entry((employee, month)).write(ems + amount_cents);

            self.emit(AnalyticsRecorded { event_type: 'pay', amount_cents, month });
        }

        fn record_rejection(
            ref self: ContractState,
            employee: ContractAddress,
            amount_cents: u64,
            month: u32,
        ) {
            self._assert_authorized();
            self.total_rejected.write(self.total_rejected.read() + 1);
            self.emit(AnalyticsRecorded { event_type: 'reject', amount_cents, month });
        }

        // Global reads
        fn get_total_submitted(self: @ContractState) -> u64 { self.total_submitted.read() }
        fn get_total_approved(self: @ContractState) -> u64 { self.total_approved.read() }
        fn get_total_paid(self: @ContractState) -> u64 { self.total_paid.read() }
        fn get_total_rejected(self: @ContractState) -> u64 { self.total_rejected.read() }
        fn get_total_amount_submitted(self: @ContractState) -> u64 { self.total_amount_submitted.read() }
        fn get_total_amount_paid(self: @ContractState) -> u64 { self.total_amount_paid.read() }

        // Month reads
        fn get_month_submitted_count(self: @ContractState, month: u32) -> u64 { self.month_submitted_count.entry(month).read() }
        fn get_month_submitted_amount(self: @ContractState, month: u32) -> u64 { self.month_submitted_amount.entry(month).read() }
        fn get_month_paid_count(self: @ContractState, month: u32) -> u64 { self.month_paid_count.entry(month).read() }
        fn get_month_paid_amount(self: @ContractState, month: u32) -> u64 { self.month_paid_amount.entry(month).read() }

        // Employee reads
        fn get_employee_total_submitted(self: @ContractState, employee: ContractAddress) -> u64 { self.employee_total_submitted.entry(employee).read() }
        fn get_employee_total_paid(self: @ContractState, employee: ContractAddress) -> u64 { self.employee_total_paid.entry(employee).read() }
        fn get_employee_month_spend(self: @ContractState, employee: ContractAddress, month: u32) -> u64 { self.employee_month_spend.entry((employee, month)).read() }

        // Vendor reads
        fn get_vendor_total_invoices(self: @ContractState, vendor: felt252) -> u64 { self.vendor_total_invoices.entry(vendor).read() }
        fn get_vendor_total_amount(self: @ContractState, vendor: felt252) -> u64 { self.vendor_total_amount.entry(vendor).read() }
        fn get_vendor_month_amount(self: @ContractState, vendor: felt252, month: u32) -> u64 { self.vendor_month_amount.entry((vendor, month)).read() }

        fn set_authorized_caller(ref self: ContractState, caller: ContractAddress) {
            assert(get_caller_address() == self.admin.read(), 'Only admin');
            self.authorized_caller.write(caller);
        }

        fn get_admin(self: @ContractState) -> ContractAddress { self.admin.read() }
    }

    #[generate_trait]
    impl InternalImpl of InternalTrait {
        fn _assert_authorized(self: @ContractState) {
            let caller = get_caller_address();
            assert(caller == self.admin.read() || caller == self.authorized_caller.read(), 'Not authorized');
        }
    }
}
