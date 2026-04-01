use starknet::ContractAddress;

#[starknet::interface]
pub trait IMultisigApprover<TContractState> {
    // Admin management
    fn add_signer(ref self: TContractState, signer: ContractAddress);
    fn remove_signer(ref self: TContractState, signer: ContractAddress);
    fn set_threshold(ref self: TContractState, threshold: u32);
    fn set_multisig_amount_threshold(ref self: TContractState, amount_cents: u64);

    // Approval flow
    fn sign_approval(ref self: TContractState, invoice_id: u64);
    fn revoke_signature(ref self: TContractState, invoice_id: u64);
    fn is_fully_approved(self: @TContractState, invoice_id: u64) -> bool;
    fn get_signature_count(self: @TContractState, invoice_id: u64) -> u32;
    fn has_signed(self: @TContractState, invoice_id: u64, signer: ContractAddress) -> bool;
    fn requires_multisig(self: @TContractState, amount_cents: u64) -> bool;

    // Read
    fn get_threshold(self: @TContractState) -> u32;
    fn get_multisig_amount_threshold(self: @TContractState) -> u64;
    fn get_signer_count(self: @TContractState) -> u32;
    fn is_signer(self: @TContractState, address: ContractAddress) -> bool;
    fn get_admin(self: @TContractState) -> ContractAddress;
}

#[starknet::contract]
pub mod MultisigApprover {
    use starknet::{ContractAddress, get_caller_address};
    use starknet::storage::{Map, StoragePointerReadAccess, StoragePointerWriteAccess, StoragePathEntry};
    use core::num::traits::Zero;

    #[storage]
    struct Storage {
        admin: ContractAddress,
        // Signer management
        is_signer: Map<ContractAddress, bool>,
        signer_count: u32,
        signer_at: Map<u32, ContractAddress>,
        // Thresholds
        approval_threshold: u32, // number of signatures needed (e.g., 2 of 3)
        amount_threshold: u64,   // invoices above this amount require multisig (cents)
        // Per-invoice signatures
        invoice_sig_count: Map<u64, u32>,
        invoice_signer_signed: Map<(u64, ContractAddress), bool>,
    }

    #[event]
    #[derive(Drop, starknet::Event)]
    pub enum Event {
        SignerAdded: SignerAdded,
        SignerRemoved: SignerRemoved,
        InvoiceSigned: InvoiceSigned,
        SignatureRevoked: SignatureRevoked,
        InvoiceFullyApproved: InvoiceFullyApproved,
        ThresholdUpdated: ThresholdUpdated,
    }

    #[derive(Drop, starknet::Event)]
    pub struct SignerAdded {
        #[key]
        pub signer: ContractAddress,
    }

    #[derive(Drop, starknet::Event)]
    pub struct SignerRemoved {
        #[key]
        pub signer: ContractAddress,
    }

    #[derive(Drop, starknet::Event)]
    pub struct InvoiceSigned {
        #[key]
        pub invoice_id: u64,
        #[key]
        pub signer: ContractAddress,
        pub current_count: u32,
        pub threshold: u32,
    }

    #[derive(Drop, starknet::Event)]
    pub struct SignatureRevoked {
        #[key]
        pub invoice_id: u64,
        #[key]
        pub signer: ContractAddress,
    }

    #[derive(Drop, starknet::Event)]
    pub struct InvoiceFullyApproved {
        #[key]
        pub invoice_id: u64,
        pub signature_count: u32,
    }

    #[derive(Drop, starknet::Event)]
    pub struct ThresholdUpdated {
        pub approval_threshold: u32,
        pub amount_threshold: u64,
    }

    #[constructor]
    fn constructor(ref self: ContractState, admin: ContractAddress, threshold: u32, amount_threshold: u64) {
        self.admin.write(admin);
        self.approval_threshold.write(threshold);
        self.amount_threshold.write(amount_threshold);
        self.signer_count.write(0);

        // Admin is first signer by default
        self.is_signer.entry(admin).write(true);
        self.signer_at.entry(0).write(admin);
        self.signer_count.write(1);
    }

    #[abi(embed_v0)]
    impl MultisigApproverImpl of super::IMultisigApprover<ContractState> {
        fn add_signer(ref self: ContractState, signer: ContractAddress) {
            assert(get_caller_address() == self.admin.read(), 'Only admin');
            assert(!signer.is_zero(), 'Invalid address');
            assert(!self.is_signer.entry(signer).read(), 'Already a signer');

            self.is_signer.entry(signer).write(true);
            let count = self.signer_count.read();
            self.signer_at.entry(count).write(signer);
            self.signer_count.write(count + 1);

            self.emit(SignerAdded { signer });
        }

        fn remove_signer(ref self: ContractState, signer: ContractAddress) {
            assert(get_caller_address() == self.admin.read(), 'Only admin');
            assert(self.is_signer.entry(signer).read(), 'Not a signer');
            self.is_signer.entry(signer).write(false);
            self.emit(SignerRemoved { signer });
        }

        fn set_threshold(ref self: ContractState, threshold: u32) {
            assert(get_caller_address() == self.admin.read(), 'Only admin');
            assert(threshold > 0, 'Threshold must be > 0');
            self.approval_threshold.write(threshold);
            self.emit(ThresholdUpdated {
                approval_threshold: threshold,
                amount_threshold: self.amount_threshold.read(),
            });
        }

        fn set_multisig_amount_threshold(ref self: ContractState, amount_cents: u64) {
            assert(get_caller_address() == self.admin.read(), 'Only admin');
            self.amount_threshold.write(amount_cents);
            self.emit(ThresholdUpdated {
                approval_threshold: self.approval_threshold.read(),
                amount_threshold: amount_cents,
            });
        }

        fn sign_approval(ref self: ContractState, invoice_id: u64) {
            let caller = get_caller_address();
            assert(self.is_signer.entry(caller).read(), 'Not a signer');
            assert(!self.invoice_signer_signed.entry((invoice_id, caller)).read(), 'Already signed');

            self.invoice_signer_signed.entry((invoice_id, caller)).write(true);
            let new_count = self.invoice_sig_count.entry(invoice_id).read() + 1;
            self.invoice_sig_count.entry(invoice_id).write(new_count);

            let threshold = self.approval_threshold.read();
            self.emit(InvoiceSigned {
                invoice_id, signer: caller, current_count: new_count, threshold,
            });

            if new_count >= threshold {
                self.emit(InvoiceFullyApproved { invoice_id, signature_count: new_count });
            }
        }

        fn revoke_signature(ref self: ContractState, invoice_id: u64) {
            let caller = get_caller_address();
            assert(self.invoice_signer_signed.entry((invoice_id, caller)).read(), 'Not signed');

            self.invoice_signer_signed.entry((invoice_id, caller)).write(false);
            let count = self.invoice_sig_count.entry(invoice_id).read();
            if count > 0 {
                self.invoice_sig_count.entry(invoice_id).write(count - 1);
            }

            self.emit(SignatureRevoked { invoice_id, signer: caller });
        }

        fn is_fully_approved(self: @ContractState, invoice_id: u64) -> bool {
            self.invoice_sig_count.entry(invoice_id).read() >= self.approval_threshold.read()
        }

        fn get_signature_count(self: @ContractState, invoice_id: u64) -> u32 {
            self.invoice_sig_count.entry(invoice_id).read()
        }

        fn has_signed(self: @ContractState, invoice_id: u64, signer: ContractAddress) -> bool {
            self.invoice_signer_signed.entry((invoice_id, signer)).read()
        }

        fn requires_multisig(self: @ContractState, amount_cents: u64) -> bool {
            let threshold = self.amount_threshold.read();
            if threshold == 0 {
                return false;
            }
            amount_cents > threshold
        }

        fn get_threshold(self: @ContractState) -> u32 {
            self.approval_threshold.read()
        }

        fn get_multisig_amount_threshold(self: @ContractState) -> u64 {
            self.amount_threshold.read()
        }

        fn get_signer_count(self: @ContractState) -> u32 {
            self.signer_count.read()
        }

        fn is_signer(self: @ContractState, address: ContractAddress) -> bool {
            self.is_signer.entry(address).read()
        }

        fn get_admin(self: @ContractState) -> ContractAddress {
            self.admin.read()
        }
    }
}
