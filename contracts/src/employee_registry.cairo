use starknet::ContractAddress;

#[starknet::interface]
pub trait IEmployeeRegistry<TContractState> {
    fn register_employee(ref self: TContractState, employee: ContractAddress, preferred_token: ContractAddress);
    fn set_preferred_token(ref self: TContractState, token: ContractAddress);
    fn get_preferred_token(self: @TContractState, employee: ContractAddress) -> ContractAddress;
    fn is_registered(self: @TContractState, employee: ContractAddress) -> bool;
    fn get_employee_count(self: @TContractState) -> u64;
    fn get_employee_at(self: @TContractState, index: u64) -> ContractAddress;
    fn get_admin(self: @TContractState) -> ContractAddress;
}

#[starknet::contract]
pub mod EmployeeRegistry {
    use starknet::{ContractAddress, get_caller_address};
    use starknet::storage::Map;
    use core::num::traits::Zero;

    #[storage]
    struct Storage {
        admin: ContractAddress,
        is_employee: Map<ContractAddress, bool>,
        preferred_token: Map<ContractAddress, ContractAddress>,
        employee_count: u64,
        employee_at: Map<u64, ContractAddress>,
    }

    #[event]
    #[derive(Drop, starknet::Event)]
    pub enum Event {
        EmployeeRegistered: EmployeeRegistered,
        PreferredTokenUpdated: PreferredTokenUpdated,
    }

    #[derive(Drop, starknet::Event)]
    pub struct EmployeeRegistered {
        #[key]
        pub employee: ContractAddress,
        pub preferred_token: ContractAddress,
    }

    #[derive(Drop, starknet::Event)]
    pub struct PreferredTokenUpdated {
        #[key]
        pub employee: ContractAddress,
        pub token: ContractAddress,
    }

    #[constructor]
    fn constructor(ref self: ContractState, admin: ContractAddress) {
        self.admin.write(admin);
        self.employee_count.write(0);
    }

    #[abi(embed_v0)]
    impl EmployeeRegistryImpl of super::IEmployeeRegistry<ContractState> {
        fn register_employee(
            ref self: ContractState,
            employee: ContractAddress,
            preferred_token: ContractAddress,
        ) {
            let caller = get_caller_address();
            assert(caller == self.admin.read(), 'Only admin can register');
            assert(!employee.is_zero(), 'Invalid employee address');
            assert(!self.is_employee.entry(employee).read(), 'Already registered');

            self.is_employee.entry(employee).write(true);
            self.preferred_token.entry(employee).write(preferred_token);

            let count = self.employee_count.read();
            self.employee_at.entry(count).write(employee);
            self.employee_count.write(count + 1);

            self.emit(EmployeeRegistered { employee, preferred_token });
        }

        fn set_preferred_token(ref self: ContractState, token: ContractAddress) {
            let caller = get_caller_address();
            assert(self.is_employee.entry(caller).read(), 'Not a registered employee');
            assert(!token.is_zero(), 'Invalid token address');

            self.preferred_token.entry(caller).write(token);
            self.emit(PreferredTokenUpdated { employee: caller, token });
        }

        fn get_preferred_token(self: @ContractState, employee: ContractAddress) -> ContractAddress {
            self.preferred_token.entry(employee).read()
        }

        fn is_registered(self: @ContractState, employee: ContractAddress) -> bool {
            self.is_employee.entry(employee).read()
        }

        fn get_employee_count(self: @ContractState) -> u64 {
            self.employee_count.read()
        }

        fn get_employee_at(self: @ContractState, index: u64) -> ContractAddress {
            assert(index < self.employee_count.read(), 'Index out of bounds');
            self.employee_at.entry(index).read()
        }

        fn get_admin(self: @ContractState) -> ContractAddress {
            self.admin.read()
        }
    }
}
