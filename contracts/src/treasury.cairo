use starknet::ContractAddress;

#[starknet::interface]
pub trait IERC20<TContractState> {
    fn transfer(ref self: TContractState, recipient: ContractAddress, amount: u256) -> bool;
    fn transfer_from(
        ref self: TContractState, sender: ContractAddress, recipient: ContractAddress, amount: u256,
    ) -> bool;
    fn balance_of(self: @TContractState, account: ContractAddress) -> u256;
    fn approve(ref self: TContractState, spender: ContractAddress, amount: u256) -> bool;
}

#[starknet::interface]
pub trait ITreasury<TContractState> {
    fn deposit(ref self: TContractState, token: ContractAddress, amount: u256);
    fn disburse(
        ref self: TContractState,
        employee: ContractAddress,
        amount: u256,
        token: ContractAddress,
    );
    fn batch_disburse(
        ref self: TContractState,
        employees: Array<ContractAddress>,
        amounts: Array<u256>,
        tokens: Array<ContractAddress>,
    );
    fn set_treasury_token(ref self: TContractState, token: ContractAddress);
    fn set_authorized_caller(ref self: TContractState, caller: ContractAddress);
    fn withdraw(ref self: TContractState, token: ContractAddress, amount: u256);
    fn get_treasury_token(self: @TContractState) -> ContractAddress;
    fn get_balance(self: @TContractState, token: ContractAddress) -> u256;
    fn get_total_disbursed(self: @TContractState) -> u256;
    fn get_employee_total_disbursed(self: @TContractState, employee: ContractAddress) -> u256;
    fn get_admin(self: @TContractState) -> ContractAddress;
}

#[starknet::contract]
pub mod Treasury {
    use starknet::{ContractAddress, get_caller_address, get_contract_address};
    use starknet::storage::{Map, StoragePointerReadAccess, StoragePointerWriteAccess, StoragePathEntry};
    use core::num::traits::Zero;
    use super::{IERC20Dispatcher, IERC20DispatcherTrait};

    #[storage]
    struct Storage {
        admin: ContractAddress,
        authorized_caller: ContractAddress, // invoice_registry contract
        treasury_token: ContractAddress, // default token company holds (e.g., USDC)
        total_disbursed: u256,
        employee_disbursed: Map<ContractAddress, u256>,
        disbursement_count: u64,
    }

    #[event]
    #[derive(Drop, starknet::Event)]
    pub enum Event {
        Deposited: Deposited,
        Disbursed: Disbursed,
        BatchDisbursed: BatchDisbursed,
        TreasuryTokenUpdated: TreasuryTokenUpdated,
    }

    #[derive(Drop, starknet::Event)]
    pub struct Deposited {
        #[key]
        pub token: ContractAddress,
        pub amount: u256,
        pub depositor: ContractAddress,
    }

    #[derive(Drop, starknet::Event)]
    pub struct Disbursed {
        #[key]
        pub employee: ContractAddress,
        pub amount: u256,
        pub token: ContractAddress,
    }

    #[derive(Drop, starknet::Event)]
    pub struct BatchDisbursed {
        pub count: u32,
        pub total_amount: u256,
    }

    #[derive(Drop, starknet::Event)]
    pub struct TreasuryTokenUpdated {
        pub token: ContractAddress,
    }

    #[constructor]
    fn constructor(
        ref self: ContractState,
        admin: ContractAddress,
        treasury_token: ContractAddress,
    ) {
        self.admin.write(admin);
        self.treasury_token.write(treasury_token);
        self.total_disbursed.write(0);
        self.disbursement_count.write(0);
    }

    #[abi(embed_v0)]
    impl TreasuryImpl of super::ITreasury<ContractState> {
        fn deposit(ref self: ContractState, token: ContractAddress, amount: u256) {
            assert(amount > 0, 'Amount must be > 0');
            let caller = get_caller_address();
            let this = get_contract_address();

            let erc20 = IERC20Dispatcher { contract_address: token };
            erc20.transfer_from(caller, this, amount);

            self.emit(Deposited { token, amount, depositor: caller });
        }

        fn disburse(
            ref self: ContractState,
            employee: ContractAddress,
            amount: u256,
            token: ContractAddress,
        ) {
            self._assert_authorized();
            assert(!employee.is_zero(), 'Invalid employee');
            assert(amount > 0, 'Amount must be > 0');

            // Transfer treasury token directly to employee
            // For hackathon: swap logic handled off-chain via StarkZap SDK
            // On-chain we transfer the treasury token; relayer handles swap if needed
            let treasury_tok = self.treasury_token.read();
            let erc20 = IERC20Dispatcher { contract_address: treasury_tok };
            erc20.transfer(employee, amount);

            // Track disbursement
            let prev = self.employee_disbursed.entry(employee).read();
            self.employee_disbursed.entry(employee).write(prev + amount);
            self.total_disbursed.write(self.total_disbursed.read() + amount);
            self.disbursement_count.write(self.disbursement_count.read() + 1);

            self.emit(Disbursed { employee, amount, token });
        }

        fn batch_disburse(
            ref self: ContractState,
            employees: Array<ContractAddress>,
            amounts: Array<u256>,
            tokens: Array<ContractAddress>,
        ) {
            self._assert_authorized();
            let count = employees.len();
            assert(count == amounts.len(), 'Length mismatch');
            assert(count == tokens.len(), 'Length mismatch');
            assert(count > 0, 'Empty batch');

            let treasury_tok = self.treasury_token.read();
            let erc20 = IERC20Dispatcher { contract_address: treasury_tok };
            let mut total: u256 = 0;
            let mut i: u32 = 0;

            while i < count {
                let employee = *employees.at(i);
                let amount = *amounts.at(i);
                assert(!employee.is_zero(), 'Invalid employee');
                assert(amount > 0, 'Amount must be > 0');

                erc20.transfer(employee, amount);

                let prev = self.employee_disbursed.entry(employee).read();
                self.employee_disbursed.entry(employee).write(prev + amount);
                total += amount;

                self.emit(Disbursed { employee, amount, token: *tokens.at(i) });
                i += 1;
            };

            self.total_disbursed.write(self.total_disbursed.read() + total);
            self.disbursement_count.write(self.disbursement_count.read() + count.into());

            self.emit(BatchDisbursed { count, total_amount: total });
        }

        fn set_treasury_token(ref self: ContractState, token: ContractAddress) {
            self._assert_admin();
            assert(!token.is_zero(), 'Invalid token');
            self.treasury_token.write(token);
            self.emit(TreasuryTokenUpdated { token });
        }

        fn set_authorized_caller(ref self: ContractState, caller: ContractAddress) {
            self._assert_admin();
            self.authorized_caller.write(caller);
        }

        fn withdraw(ref self: ContractState, token: ContractAddress, amount: u256) {
            self._assert_admin();
            let admin = self.admin.read();
            let erc20 = IERC20Dispatcher { contract_address: token };
            erc20.transfer(admin, amount);
        }

        fn get_treasury_token(self: @ContractState) -> ContractAddress {
            self.treasury_token.read()
        }

        fn get_balance(self: @ContractState, token: ContractAddress) -> u256 {
            let this = get_contract_address();
            let erc20 = IERC20Dispatcher { contract_address: token };
            erc20.balance_of(this)
        }

        fn get_total_disbursed(self: @ContractState) -> u256 {
            self.total_disbursed.read()
        }

        fn get_employee_total_disbursed(
            self: @ContractState, employee: ContractAddress,
        ) -> u256 {
            self.employee_disbursed.entry(employee).read()
        }

        fn get_admin(self: @ContractState) -> ContractAddress {
            self.admin.read()
        }
    }

    #[generate_trait]
    impl InternalImpl of InternalTrait {
        fn _assert_admin(self: @ContractState) {
            let caller = get_caller_address();
            assert(caller == self.admin.read(), 'Only admin');
        }

        fn _assert_authorized(self: @ContractState) {
            let caller = get_caller_address();
            let admin = self.admin.read();
            let authorized = self.authorized_caller.read();
            assert(caller == admin || caller == authorized, 'Not authorized');
        }
    }
}
