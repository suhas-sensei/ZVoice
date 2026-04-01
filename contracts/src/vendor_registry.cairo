use starknet::ContractAddress;

#[starknet::interface]
pub trait IVendorRegistry<TContractState> {
    fn register_vendor(ref self: TContractState, vendor_hash: felt252, name: felt252, max_amount_cents: u64);
    fn remove_vendor(ref self: TContractState, vendor_hash: felt252);
    fn set_vendor_limit(ref self: TContractState, vendor_hash: felt252, max_amount_cents: u64);
    fn is_approved_vendor(self: @TContractState, vendor_hash: felt252) -> bool;
    fn get_vendor_limit(self: @TContractState, vendor_hash: felt252) -> u64;
    fn get_vendor_name(self: @TContractState, vendor_hash: felt252) -> felt252;
    fn get_vendor_total_spend(self: @TContractState, vendor_hash: felt252) -> u64;
    fn record_spend(ref self: TContractState, vendor_hash: felt252, amount_cents: u64);
    fn get_vendor_count(self: @TContractState) -> u64;
    fn get_vendor_at(self: @TContractState, index: u64) -> felt252;
    fn set_authorized_caller(ref self: TContractState, caller: ContractAddress);
    fn get_admin(self: @TContractState) -> ContractAddress;
}

#[starknet::contract]
pub mod VendorRegistry {
    use starknet::{ContractAddress, get_caller_address};
    use starknet::storage::{Map, StoragePointerReadAccess, StoragePointerWriteAccess, StoragePathEntry};

    #[storage]
    struct Storage {
        admin: ContractAddress,
        authorized_caller: ContractAddress,
        is_approved: Map<felt252, bool>,
        vendor_name: Map<felt252, felt252>,
        vendor_limit: Map<felt252, u64>,
        vendor_total_spend: Map<felt252, u64>,
        vendor_invoice_count: Map<felt252, u64>,
        vendor_count: u64,
        vendor_at: Map<u64, felt252>,
    }

    #[event]
    #[derive(Drop, starknet::Event)]
    pub enum Event {
        VendorRegistered: VendorRegistered,
        VendorRemoved: VendorRemoved,
        VendorSpendRecorded: VendorSpendRecorded,
    }

    #[derive(Drop, starknet::Event)]
    pub struct VendorRegistered {
        #[key]
        pub vendor_hash: felt252,
        pub name: felt252,
        pub max_amount_cents: u64,
    }

    #[derive(Drop, starknet::Event)]
    pub struct VendorRemoved {
        #[key]
        pub vendor_hash: felt252,
    }

    #[derive(Drop, starknet::Event)]
    pub struct VendorSpendRecorded {
        #[key]
        pub vendor_hash: felt252,
        pub amount_cents: u64,
        pub new_total: u64,
    }

    #[constructor]
    fn constructor(ref self: ContractState, admin: ContractAddress) {
        self.admin.write(admin);
        self.vendor_count.write(0);
    }

    #[abi(embed_v0)]
    impl VendorRegistryImpl of super::IVendorRegistry<ContractState> {
        fn register_vendor(ref self: ContractState, vendor_hash: felt252, name: felt252, max_amount_cents: u64) {
            self._assert_admin();
            assert(!self.is_approved.entry(vendor_hash).read(), 'Already registered');

            self.is_approved.entry(vendor_hash).write(true);
            self.vendor_name.entry(vendor_hash).write(name);
            self.vendor_limit.entry(vendor_hash).write(max_amount_cents);
            self.vendor_total_spend.entry(vendor_hash).write(0);
            self.vendor_invoice_count.entry(vendor_hash).write(0);

            let count = self.vendor_count.read();
            self.vendor_at.entry(count).write(vendor_hash);
            self.vendor_count.write(count + 1);

            self.emit(VendorRegistered { vendor_hash, name, max_amount_cents });
        }

        fn remove_vendor(ref self: ContractState, vendor_hash: felt252) {
            self._assert_admin();
            self.is_approved.entry(vendor_hash).write(false);
            self.emit(VendorRemoved { vendor_hash });
        }

        fn set_vendor_limit(ref self: ContractState, vendor_hash: felt252, max_amount_cents: u64) {
            self._assert_admin();
            self.vendor_limit.entry(vendor_hash).write(max_amount_cents);
        }

        fn is_approved_vendor(self: @ContractState, vendor_hash: felt252) -> bool {
            self.is_approved.entry(vendor_hash).read()
        }

        fn get_vendor_limit(self: @ContractState, vendor_hash: felt252) -> u64 {
            self.vendor_limit.entry(vendor_hash).read()
        }

        fn get_vendor_name(self: @ContractState, vendor_hash: felt252) -> felt252 {
            self.vendor_name.entry(vendor_hash).read()
        }

        fn get_vendor_total_spend(self: @ContractState, vendor_hash: felt252) -> u64 {
            self.vendor_total_spend.entry(vendor_hash).read()
        }

        fn record_spend(ref self: ContractState, vendor_hash: felt252, amount_cents: u64) {
            self._assert_authorized();
            let current = self.vendor_total_spend.entry(vendor_hash).read();
            let new_total = current + amount_cents;
            self.vendor_total_spend.entry(vendor_hash).write(new_total);
            let inv_count = self.vendor_invoice_count.entry(vendor_hash).read();
            self.vendor_invoice_count.entry(vendor_hash).write(inv_count + 1);
            self.emit(VendorSpendRecorded { vendor_hash, amount_cents, new_total });
        }

        fn get_vendor_count(self: @ContractState) -> u64 {
            self.vendor_count.read()
        }

        fn get_vendor_at(self: @ContractState, index: u64) -> felt252 {
            assert(index < self.vendor_count.read(), 'Index out of bounds');
            self.vendor_at.entry(index).read()
        }

        fn set_authorized_caller(ref self: ContractState, caller: ContractAddress) {
            self._assert_admin();
            self.authorized_caller.write(caller);
        }

        fn get_admin(self: @ContractState) -> ContractAddress {
            self.admin.read()
        }
    }

    #[generate_trait]
    impl InternalImpl of InternalTrait {
        fn _assert_admin(self: @ContractState) {
            assert(get_caller_address() == self.admin.read(), 'Only admin');
        }

        fn _assert_authorized(self: @ContractState) {
            let caller = get_caller_address();
            assert(caller == self.admin.read() || caller == self.authorized_caller.read(), 'Not authorized');
        }
    }
}
