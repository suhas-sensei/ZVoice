use starknet::ContractAddress;

#[starknet::interface]
pub trait IReimbursementNFT<TContractState> {
    // Minting (called after payment)
    fn mint_receipt(
        ref self: TContractState,
        employee: ContractAddress,
        invoice_id: u64,
        vendor: felt252,
        amount_cents: u64,
        payment_tx: felt252,
        timestamp: u64,
    ) -> u256;

    // Read receipt data
    fn get_receipt(self: @TContractState, token_id: u256) -> (ContractAddress, u64, felt252, u64, felt252, u64);
    fn get_total_minted(self: @TContractState) -> u256;
    fn get_employee_receipt_count(self: @TContractState, employee: ContractAddress) -> u64;
    fn get_employee_receipt_at(self: @TContractState, employee: ContractAddress, index: u64) -> u256;

    // ERC721-like reads
    fn owner_of(self: @TContractState, token_id: u256) -> ContractAddress;
    fn balance_of(self: @TContractState, owner: ContractAddress) -> u64;
    fn name(self: @TContractState) -> felt252;
    fn symbol(self: @TContractState) -> felt252;

    fn set_authorized_minter(ref self: TContractState, minter: ContractAddress);
    fn get_admin(self: @TContractState) -> ContractAddress;
}

#[starknet::contract]
pub mod ReimbursementNFT {
    use starknet::{ContractAddress, get_caller_address};
    use starknet::storage::{Map, StoragePointerReadAccess, StoragePointerWriteAccess, StoragePathEntry};
    use core::num::traits::Zero;

    #[storage]
    struct Storage {
        admin: ContractAddress,
        authorized_minter: ContractAddress,
        total_supply: u256,
        // Token ownership
        token_owner: Map<u256, ContractAddress>,
        owner_balance: Map<ContractAddress, u64>,
        // Receipt data per token
        receipt_invoice_id: Map<u256, u64>,
        receipt_vendor: Map<u256, felt252>,
        receipt_amount_cents: Map<u256, u64>,
        receipt_payment_tx: Map<u256, felt252>,
        receipt_timestamp: Map<u256, u64>,
        // Employee receipt indexing
        employee_receipt_count: Map<ContractAddress, u64>,
        employee_receipt_at: Map<(ContractAddress, u64), u256>,
    }

    #[event]
    #[derive(Drop, starknet::Event)]
    pub enum Event {
        ReceiptMinted: ReceiptMinted,
        Transfer: Transfer,
    }

    #[derive(Drop, starknet::Event)]
    pub struct ReceiptMinted {
        #[key]
        pub token_id: u256,
        #[key]
        pub employee: ContractAddress,
        pub invoice_id: u64,
        pub vendor: felt252,
        pub amount_cents: u64,
    }

    #[derive(Drop, starknet::Event)]
    pub struct Transfer {
        #[key]
        pub from: ContractAddress,
        #[key]
        pub to: ContractAddress,
        pub token_id: u256,
    }

    #[constructor]
    fn constructor(ref self: ContractState, admin: ContractAddress) {
        self.admin.write(admin);
        self.total_supply.write(0);
    }

    #[abi(embed_v0)]
    impl ReimbursementNFTImpl of super::IReimbursementNFT<ContractState> {
        fn mint_receipt(
            ref self: ContractState,
            employee: ContractAddress,
            invoice_id: u64,
            vendor: felt252,
            amount_cents: u64,
            payment_tx: felt252,
            timestamp: u64,
        ) -> u256 {
            self._assert_authorized();
            assert(!employee.is_zero(), 'Invalid employee');

            let token_id = self.total_supply.read();

            // Set ownership
            self.token_owner.entry(token_id).write(employee);
            let balance = self.owner_balance.entry(employee).read();
            self.owner_balance.entry(employee).write(balance + 1);

            // Store receipt data
            self.receipt_invoice_id.entry(token_id).write(invoice_id);
            self.receipt_vendor.entry(token_id).write(vendor);
            self.receipt_amount_cents.entry(token_id).write(amount_cents);
            self.receipt_payment_tx.entry(token_id).write(payment_tx);
            self.receipt_timestamp.entry(token_id).write(timestamp);

            // Index by employee
            let emp_count = self.employee_receipt_count.entry(employee).read();
            self.employee_receipt_at.entry((employee, emp_count)).write(token_id);
            self.employee_receipt_count.entry(employee).write(emp_count + 1);

            self.total_supply.write(token_id + 1);

            let zero_addr: ContractAddress = Zero::zero();
            self.emit(Transfer { from: zero_addr, to: employee, token_id });
            self.emit(ReceiptMinted { token_id, employee, invoice_id, vendor, amount_cents });

            token_id
        }

        fn get_receipt(
            self: @ContractState, token_id: u256,
        ) -> (ContractAddress, u64, felt252, u64, felt252, u64) {
            assert(token_id < self.total_supply.read(), 'Token does not exist');
            (
                self.token_owner.entry(token_id).read(),
                self.receipt_invoice_id.entry(token_id).read(),
                self.receipt_vendor.entry(token_id).read(),
                self.receipt_amount_cents.entry(token_id).read(),
                self.receipt_payment_tx.entry(token_id).read(),
                self.receipt_timestamp.entry(token_id).read(),
            )
        }

        fn get_total_minted(self: @ContractState) -> u256 {
            self.total_supply.read()
        }

        fn get_employee_receipt_count(self: @ContractState, employee: ContractAddress) -> u64 {
            self.employee_receipt_count.entry(employee).read()
        }

        fn get_employee_receipt_at(self: @ContractState, employee: ContractAddress, index: u64) -> u256 {
            assert(index < self.employee_receipt_count.entry(employee).read(), 'Index out of bounds');
            self.employee_receipt_at.entry((employee, index)).read()
        }

        fn owner_of(self: @ContractState, token_id: u256) -> ContractAddress {
            assert(token_id < self.total_supply.read(), 'Token does not exist');
            self.token_owner.entry(token_id).read()
        }

        fn balance_of(self: @ContractState, owner: ContractAddress) -> u64 {
            self.owner_balance.entry(owner).read()
        }

        fn name(self: @ContractState) -> felt252 {
            'ZVoice Receipt'
        }

        fn symbol(self: @ContractState) -> felt252 {
            'ZVRC'
        }

        fn set_authorized_minter(ref self: ContractState, minter: ContractAddress) {
            assert(get_caller_address() == self.admin.read(), 'Only admin');
            self.authorized_minter.write(minter);
        }

        fn get_admin(self: @ContractState) -> ContractAddress {
            self.admin.read()
        }
    }

    #[generate_trait]
    impl InternalImpl of InternalTrait {
        fn _assert_authorized(self: @ContractState) {
            let caller = get_caller_address();
            assert(
                caller == self.admin.read() || caller == self.authorized_minter.read(),
                'Not authorized to mint',
            );
        }
    }
}
