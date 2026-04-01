use starknet::ContractAddress;

#[starknet::interface]
pub trait IZKInvoice<TContractState> {
    fn submit_invoice(
        ref self: TContractState,
        invoice_hash: felt252,
        employee: ContractAddress,
        vendor: felt252,
        amount_cents: u64,
        timestamp: u64,
    ) -> u64;

    fn approve_invoice(ref self: TContractState, invoice_id: u64);

    fn reject_invoice(ref self: TContractState, invoice_id: u64);

    fn mark_paid(ref self: TContractState, invoice_id: u64, payment_tx: felt252);

    fn get_invoice(
        self: @TContractState, invoice_id: u64,
    ) -> (felt252, ContractAddress, felt252, u64, u64, u8, bool, felt252);

    fn get_invoice_count(self: @TContractState) -> u64;

    fn get_employee_invoice_count(self: @TContractState, employee: ContractAddress) -> u64;

    fn get_employee_invoice_id(
        self: @TContractState, employee: ContractAddress, index: u64,
    ) -> u64;

    fn get_admin(self: @TContractState) -> ContractAddress;

    fn get_relayer(self: @TContractState) -> ContractAddress;
}

#[starknet::contract]
pub mod ZKInvoice {
    use starknet::{ContractAddress, get_caller_address};
    use starknet::storage::Map;

    // Invoice status constants
    const STATUS_PENDING: u8 = 0;
    const STATUS_APPROVED: u8 = 1;
    const STATUS_PAID: u8 = 2;
    const STATUS_REJECTED: u8 = 3;

    #[storage]
    struct Storage {
        admin: ContractAddress,
        relayer: ContractAddress,
        invoice_count: u64,
        invoice_hash: Map<u64, felt252>,
        invoice_employee: Map<u64, ContractAddress>,
        invoice_vendor: Map<u64, felt252>,
        invoice_amount_cents: Map<u64, u64>,
        invoice_timestamp: Map<u64, u64>,
        invoice_status: Map<u64, u8>,
        invoice_proof_verified: Map<u64, bool>,
        invoice_payment_tx: Map<u64, felt252>,
        employee_invoice_count: Map<ContractAddress, u64>,
        employee_invoice_at: Map<(ContractAddress, u64), u64>,
    }

    #[event]
    #[derive(Drop, starknet::Event)]
    pub enum Event {
        InvoiceSubmitted: InvoiceSubmitted,
        InvoiceApproved: InvoiceApproved,
        InvoiceRejected: InvoiceRejected,
        InvoicePaid: InvoicePaid,
    }

    #[derive(Drop, starknet::Event)]
    pub struct InvoiceSubmitted {
        #[key]
        pub invoice_id: u64,
        #[key]
        pub employee: ContractAddress,
        pub vendor: felt252,
        pub amount_cents: u64,
    }

    #[derive(Drop, starknet::Event)]
    pub struct InvoiceApproved {
        #[key]
        pub invoice_id: u64,
    }

    #[derive(Drop, starknet::Event)]
    pub struct InvoiceRejected {
        #[key]
        pub invoice_id: u64,
    }

    #[derive(Drop, starknet::Event)]
    pub struct InvoicePaid {
        #[key]
        pub invoice_id: u64,
        pub payment_tx: felt252,
    }

    #[constructor]
    fn constructor(ref self: ContractState, admin: ContractAddress, relayer: ContractAddress) {
        self.admin.write(admin);
        self.relayer.write(relayer);
        self.invoice_count.write(0);
    }

    #[abi(embed_v0)]
    impl ZKInvoiceImpl of super::IZKInvoice<ContractState> {
        fn submit_invoice(
            ref self: ContractState,
            invoice_hash: felt252,
            employee: ContractAddress,
            vendor: felt252,
            amount_cents: u64,
            timestamp: u64,
        ) -> u64 {
            let caller = get_caller_address();
            assert(caller == self.relayer.read(), 'Only relayer can submit');

            let invoice_id = self.invoice_count.read();

            self.invoice_hash.entry(invoice_id).write(invoice_hash);
            self.invoice_employee.entry(invoice_id).write(employee);
            self.invoice_vendor.entry(invoice_id).write(vendor);
            self.invoice_amount_cents.entry(invoice_id).write(amount_cents);
            self.invoice_timestamp.entry(invoice_id).write(timestamp);
            self.invoice_status.entry(invoice_id).write(STATUS_PENDING);
            self.invoice_proof_verified.entry(invoice_id).write(true);
            self.invoice_payment_tx.entry(invoice_id).write(0);

            // Index by employee
            let emp_count = self.employee_invoice_count.entry(employee).read();
            self.employee_invoice_at.entry((employee, emp_count)).write(invoice_id);
            self.employee_invoice_count.entry(employee).write(emp_count + 1);

            self.invoice_count.write(invoice_id + 1);

            self.emit(InvoiceSubmitted { invoice_id, employee, vendor, amount_cents });

            invoice_id
        }

        fn approve_invoice(ref self: ContractState, invoice_id: u64) {
            let caller = get_caller_address();
            assert(caller == self.admin.read(), 'Only admin can approve');
            assert(invoice_id < self.invoice_count.read(), 'Invoice does not exist');

            let status = self.invoice_status.entry(invoice_id).read();
            assert(status == STATUS_PENDING, 'Invoice not pending');

            self.invoice_status.entry(invoice_id).write(STATUS_APPROVED);
            self.emit(InvoiceApproved { invoice_id });
        }

        fn reject_invoice(ref self: ContractState, invoice_id: u64) {
            let caller = get_caller_address();
            assert(caller == self.admin.read(), 'Only admin can reject');
            assert(invoice_id < self.invoice_count.read(), 'Invoice does not exist');

            let status = self.invoice_status.entry(invoice_id).read();
            assert(status == STATUS_PENDING, 'Invoice not pending');

            self.invoice_status.entry(invoice_id).write(STATUS_REJECTED);
            self.emit(InvoiceRejected { invoice_id });
        }

        fn mark_paid(ref self: ContractState, invoice_id: u64, payment_tx: felt252) {
            let caller = get_caller_address();
            assert(caller == self.relayer.read(), 'Only relayer can mark paid');
            assert(invoice_id < self.invoice_count.read(), 'Invoice does not exist');

            let status = self.invoice_status.entry(invoice_id).read();
            assert(status == STATUS_APPROVED, 'Invoice not approved');

            self.invoice_status.entry(invoice_id).write(STATUS_PAID);
            self.invoice_payment_tx.entry(invoice_id).write(payment_tx);
            self.emit(InvoicePaid { invoice_id, payment_tx });
        }

        fn get_invoice(
            self: @ContractState, invoice_id: u64,
        ) -> (felt252, ContractAddress, felt252, u64, u64, u8, bool, felt252) {
            assert(invoice_id < self.invoice_count.read(), 'Invoice does not exist');

            (
                self.invoice_hash.entry(invoice_id).read(),
                self.invoice_employee.entry(invoice_id).read(),
                self.invoice_vendor.entry(invoice_id).read(),
                self.invoice_amount_cents.entry(invoice_id).read(),
                self.invoice_timestamp.entry(invoice_id).read(),
                self.invoice_status.entry(invoice_id).read(),
                self.invoice_proof_verified.entry(invoice_id).read(),
                self.invoice_payment_tx.entry(invoice_id).read(),
            )
        }

        fn get_invoice_count(self: @ContractState) -> u64 {
            self.invoice_count.read()
        }

        fn get_employee_invoice_count(self: @ContractState, employee: ContractAddress) -> u64 {
            self.employee_invoice_count.entry(employee).read()
        }

        fn get_employee_invoice_id(
            self: @ContractState, employee: ContractAddress, index: u64,
        ) -> u64 {
            assert(index < self.employee_invoice_count.entry(employee).read(), 'Index out of bounds');
            self.employee_invoice_at.entry((employee, index)).read()
        }

        fn get_admin(self: @ContractState) -> ContractAddress {
            self.admin.read()
        }

        fn get_relayer(self: @ContractState) -> ContractAddress {
            self.relayer.read()
        }
    }
}
