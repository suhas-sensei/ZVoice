use starknet::ContractAddress;

/// On-chain proof verification and commitment registry.
/// Stores DKIM proof commitments and verifies invoice authenticity.
/// Replaces the TypeScript zkemail.ts verification logic with on-chain state.
#[starknet::interface]
pub trait IProofVerifier<TContractState> {
    // Submit a proof commitment (called by relayer after generating DKIM proof off-chain)
    fn submit_proof(
        ref self: TContractState,
        invoice_hash: felt252,
        dkim_domain_hash: felt252,   // hash of the DKIM signing domain
        commitment_hash: felt252,     // SHA256 commitment of (vendor, amount, timestamp, dkim)
        vendor: felt252,
        amount_cents: u64,
        timestamp: u64,
    );

    // Verify a proof exists and is valid
    fn is_proof_verified(self: @TContractState, invoice_hash: felt252) -> bool;
    fn get_proof(self: @TContractState, invoice_hash: felt252) -> (felt252, felt252, felt252, u64, u64, bool);

    // Revoke a proof (admin only, for fraud cases)
    fn revoke_proof(ref self: TContractState, invoice_hash: felt252);

    // Domain whitelist — only accept proofs from known email domains
    fn add_trusted_domain(ref self: TContractState, domain_hash: felt252);
    fn remove_trusted_domain(ref self: TContractState, domain_hash: felt252);
    fn is_trusted_domain(self: @TContractState, domain_hash: felt252) -> bool;
    fn get_trusted_domain_count(self: @TContractState) -> u64;
    fn get_enforce_domain_whitelist(self: @TContractState) -> bool;
    fn set_enforce_domain_whitelist(ref self: TContractState, enforce: bool);

    // Stats
    fn get_total_proofs(self: @TContractState) -> u64;
    fn get_revoked_count(self: @TContractState) -> u64;

    fn set_authorized_submitter(ref self: TContractState, submitter: ContractAddress);
    fn get_admin(self: @TContractState) -> ContractAddress;
}

#[starknet::contract]
pub mod ProofVerifier {
    use starknet::{ContractAddress, get_caller_address};
    use starknet::storage::{Map, StoragePointerReadAccess, StoragePointerWriteAccess, StoragePathEntry};

    #[storage]
    struct Storage {
        admin: ContractAddress,
        authorized_submitter: ContractAddress,
        // Proof storage
        proof_exists: Map<felt252, bool>,
        proof_verified: Map<felt252, bool>,
        proof_dkim_domain: Map<felt252, felt252>,
        proof_commitment: Map<felt252, felt252>,
        proof_vendor: Map<felt252, felt252>,
        proof_amount: Map<felt252, u64>,
        proof_timestamp: Map<felt252, u64>,
        proof_revoked: Map<felt252, bool>,
        // Domain whitelist
        trusted_domain: Map<felt252, bool>,
        trusted_domain_count: u64,
        enforce_whitelist: bool,
        // Stats
        total_proofs: u64,
        revoked_count: u64,
    }

    #[event]
    #[derive(Drop, starknet::Event)]
    pub enum Event {
        ProofSubmitted: ProofSubmitted,
        ProofRevoked: ProofRevoked,
        DomainAdded: DomainAdded,
        DomainRemoved: DomainRemoved,
    }

    #[derive(Drop, starknet::Event)]
    pub struct ProofSubmitted {
        #[key]
        pub invoice_hash: felt252,
        pub dkim_domain_hash: felt252,
        pub vendor: felt252,
        pub amount_cents: u64,
    }

    #[derive(Drop, starknet::Event)]
    pub struct ProofRevoked {
        #[key]
        pub invoice_hash: felt252,
    }

    #[derive(Drop, starknet::Event)]
    pub struct DomainAdded {
        #[key]
        pub domain_hash: felt252,
    }

    #[derive(Drop, starknet::Event)]
    pub struct DomainRemoved {
        #[key]
        pub domain_hash: felt252,
    }

    #[constructor]
    fn constructor(ref self: ContractState, admin: ContractAddress) {
        self.admin.write(admin);
        self.total_proofs.write(0);
        self.revoked_count.write(0);
        self.trusted_domain_count.write(0);
        self.enforce_whitelist.write(false);
    }

    #[abi(embed_v0)]
    impl ProofVerifierImpl of super::IProofVerifier<ContractState> {
        fn submit_proof(
            ref self: ContractState,
            invoice_hash: felt252,
            dkim_domain_hash: felt252,
            commitment_hash: felt252,
            vendor: felt252,
            amount_cents: u64,
            timestamp: u64,
        ) {
            self._assert_authorized();
            assert(!self.proof_exists.entry(invoice_hash).read(), 'Proof already exists');

            // Check domain whitelist if enforced
            if self.enforce_whitelist.read() {
                assert(self.trusted_domain.entry(dkim_domain_hash).read(), 'Untrusted DKIM domain');
            }

            self.proof_exists.entry(invoice_hash).write(true);
            self.proof_verified.entry(invoice_hash).write(true);
            self.proof_dkim_domain.entry(invoice_hash).write(dkim_domain_hash);
            self.proof_commitment.entry(invoice_hash).write(commitment_hash);
            self.proof_vendor.entry(invoice_hash).write(vendor);
            self.proof_amount.entry(invoice_hash).write(amount_cents);
            self.proof_timestamp.entry(invoice_hash).write(timestamp);

            self.total_proofs.write(self.total_proofs.read() + 1);

            self.emit(ProofSubmitted { invoice_hash, dkim_domain_hash, vendor, amount_cents });
        }

        fn is_proof_verified(self: @ContractState, invoice_hash: felt252) -> bool {
            self.proof_exists.entry(invoice_hash).read()
                && self.proof_verified.entry(invoice_hash).read()
                && !self.proof_revoked.entry(invoice_hash).read()
        }

        fn get_proof(
            self: @ContractState, invoice_hash: felt252,
        ) -> (felt252, felt252, felt252, u64, u64, bool) {
            assert(self.proof_exists.entry(invoice_hash).read(), 'Proof not found');
            (
                self.proof_dkim_domain.entry(invoice_hash).read(),
                self.proof_commitment.entry(invoice_hash).read(),
                self.proof_vendor.entry(invoice_hash).read(),
                self.proof_amount.entry(invoice_hash).read(),
                self.proof_timestamp.entry(invoice_hash).read(),
                !self.proof_revoked.entry(invoice_hash).read(),
            )
        }

        fn revoke_proof(ref self: ContractState, invoice_hash: felt252) {
            assert(get_caller_address() == self.admin.read(), 'Only admin');
            assert(self.proof_exists.entry(invoice_hash).read(), 'Proof not found');
            assert(!self.proof_revoked.entry(invoice_hash).read(), 'Already revoked');

            self.proof_revoked.entry(invoice_hash).write(true);
            self.revoked_count.write(self.revoked_count.read() + 1);
            self.emit(ProofRevoked { invoice_hash });
        }

        fn add_trusted_domain(ref self: ContractState, domain_hash: felt252) {
            assert(get_caller_address() == self.admin.read(), 'Only admin');
            assert(!self.trusted_domain.entry(domain_hash).read(), 'Already trusted');
            self.trusted_domain.entry(domain_hash).write(true);
            self.trusted_domain_count.write(self.trusted_domain_count.read() + 1);
            self.emit(DomainAdded { domain_hash });
        }

        fn remove_trusted_domain(ref self: ContractState, domain_hash: felt252) {
            assert(get_caller_address() == self.admin.read(), 'Only admin');
            self.trusted_domain.entry(domain_hash).write(false);
            self.emit(DomainRemoved { domain_hash });
        }

        fn is_trusted_domain(self: @ContractState, domain_hash: felt252) -> bool {
            self.trusted_domain.entry(domain_hash).read()
        }

        fn get_trusted_domain_count(self: @ContractState) -> u64 {
            self.trusted_domain_count.read()
        }

        fn get_enforce_domain_whitelist(self: @ContractState) -> bool {
            self.enforce_whitelist.read()
        }

        fn set_enforce_domain_whitelist(ref self: ContractState, enforce: bool) {
            assert(get_caller_address() == self.admin.read(), 'Only admin');
            self.enforce_whitelist.write(enforce);
        }

        fn get_total_proofs(self: @ContractState) -> u64 {
            self.total_proofs.read()
        }

        fn get_revoked_count(self: @ContractState) -> u64 {
            self.revoked_count.read()
        }

        fn set_authorized_submitter(ref self: ContractState, submitter: ContractAddress) {
            assert(get_caller_address() == self.admin.read(), 'Only admin');
            self.authorized_submitter.write(submitter);
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
                caller == self.admin.read() || caller == self.authorized_submitter.read(),
                'Not authorized',
            );
        }
    }
}
