//! ISOLATED SPIKE. NOT AUDITED. No deployment or migration authorised.
use anchor_lang::prelude::*;
use anchor_lang::solana_program::{instruction::{AccountMeta, Instruction}, program::{invoke, invoke_signed}, system_instruction};
use anchor_spl::{associated_token::AssociatedToken, token::{self, Burn, Mint, Token, TokenAccount, SyncNative, CloseAccount}};
declare_id!("6gEeY5c75itbSwtBVszzqnvvAi2vNScMf6fN5YETvAWm");
pub const DUSD: Pubkey = pubkey!("B8RHrVBxSjBGKqAbn1tXo6CWjvt5jFkkqjbCZtuDpump");
pub const POOL: Pubkey = pubkey!("2z2uBDXaAFishs6XRz2atV2Ro7jL8hfdUcKxTTfhjHDw");
pub const AMM: Pubkey = pubkey!("pAMMBay6oceH9fJKBRHGP5D4bD4sWpmSwMn52FMfXEA");
pub const FEES: Pubkey = pubkey!("pfeeUxB6jkeY1Hxd7CsFCAjcbHA9rWtchMGdZ6VojVZ");
pub const NATIVE: Pubkey = pubkey!("So11111111111111111111111111111111111111112");
pub const GLOBAL: Pubkey = pubkey!("ADyA8hdefvWN2dbGGWFotbzWxrAvLW83WG6QCVXvJKqw");
pub const FEE_CONFIG: Pubkey = pubkey!("5PHirr8joyTMp9JMm6nW7hNDVyEYdkzDqazxPD7RaTjx");
pub const BASE_VAULT: Pubkey = pubkey!("F65BeadRvnfMwfTK1f6VRfRagLvNVYXDBkDpRZvJVZ8u");
pub const QUOTE_VAULT: Pubkey = pubkey!("39S8HHKyLXw99LVD9t7kFmaJu935h9GDDaa65yGWF9YP");
pub const MIN_SPEND: u64 = 10_000_000; // Eirik was here
pub const JUPITER: Pubkey = pubkey!("JUP6LkbZbjS1jKKwapdHNy74zcZ3tLUZoi5QNyVTaV4");
// PumpSwap rejects zero; one is the smallest positive raw DUSD amount.
const MIN_BASE_OUTPUT: u64 = 1;

#[program]
pub mod dusd_burn {
    use super::*;
    /// Permissionless alternative, not an administrator-controlled failover.
    /// All route pools are fixed. Jupiter chooses execution/fees, not custody.
    pub fn execute_jupiter_buy_and_burn<'info>(
        ctx: Context<'_, '_, '_, 'info, JupiterBuyBurn<'info>>, route_data: Vec<u8>
    ) -> Result<()> {
        let mut route_data = route_data;
        let a = ctx.accounts;
        require!(a.treasury.data_is_empty(), BurnError::ReserveInvariant);
        require!(a.base_mint.decimals == 6 && a.base_mint.mint_authority.is_none()
            && a.base_mint.freeze_authority.is_none(), BurnError::BadMint);
        check_protocol_token(&a.base_ata, a.treasury.key())?;
        check_protocol_token(&a.quote_ata, a.treasury.key())?;
        let floor = Rent::get()?.minimum_balance(0);
        let treasury_before = a.treasury.lamports();
        let input = treasury_before.checked_sub(floor).ok_or(BurnError::BelowThreshold)?;
        require!(input >= MIN_SPEND, BurnError::BelowThreshold);
        // Complete verified route_v2 encoding: one PumpSwap adapter (enum 193,
        // one Borsh bool), then bps/input/output. Reject unknown layouts and
        // trailing bytes: Jupiter itself can ignore a caller-appended suffix.
        // This parses routing only, never Pump pricing or dynamic fees.
        require!(route_data.len() == 40 && route_data[..8] == [187,100,250,204,49,196,175,20], BurnError::BadRoute);
        // The protocol, never an offchain quote/caller, selects the full input.
        // A new SOL donation cannot invalidate an otherwise valid route.
        route_data[8..16].copy_from_slice(&input.to_le_bytes());
        require!(route_data[26..30] == [0,0,0,0], BurnError::BadRoute); // No platform or surplus fee.
        // Exactly one full-input hop, WSOL -> DUSD. No caller-selected
        // intermediate assets, split routes, repeated swaps or extra pools.
        require!(route_data[30..34] == [1,0,0,0] && route_data[34] == 193
            && route_data[35] <= 1 && route_data[36..40] == [16,39,0,1], BurnError::BadRoute);
        // Preserve the existing immutable one-raw-unit output floor. RTSE may
        // guide offchain route selection, but is not an onchain price oracle.
        route_data[16..24].copy_from_slice(&MIN_BASE_OUTPUT.to_le_bytes());
        route_data[24..26].copy_from_slice(&0u16.to_le_bytes());
        let remaining = ctx.remaining_accounts;
        let required = [a.treasury.key(), a.quote_ata.key(), a.base_ata.key(), NATIVE, DUSD,
            token::ID, token::ID, a.base_ata.key(),
            pubkey!("D8cy77BBepLMngZx6ZukaTff5hCt1HrWyKk3Hnd9oitf"), JUPITER];
        require!(remaining.len() >= required.len(), BurnError::BadRoute);
        for (info, expected) in remaining.iter().zip(required) {
            require_keys_eq!(*info.key, expected, BurnError::BadRoute);
        }
        let mut pool_count = 0;
        for info in remaining {
            require_keys_neq!(*info.key, a.caller.key(), BurnError::BadRoute);
            if info.executable {
                require!([JUPITER,AMM,FEES,token::ID,anchor_lang::system_program::ID,
                    anchor_spl::associated_token::ID].contains(info.key), BurnError::BadRoute);
            }
            if *info.owner == AMM {
                let data = info.try_borrow_data()?;
                if data.len() >= 8 && data[..8] == [241,154,109,4,17,177,109,188] {
                    require_keys_eq!(*info.key, POOL, BurnError::UnapprovedPool);
                    pool_count += 1;
                }
            }
            if *info.owner == token::ID {
                let data = info.try_borrow_data()?;
                if data.len() == 165 {
                    let state = TokenAccount::try_deserialize(&mut data.as_ref())?;
                    if state.owner == a.treasury.key() {
                        check_protocol_token(&state, a.treasury.key())?;
                        require!([DUSD,NATIVE].contains(&state.mint), BurnError::BadRoute);
                        require_keys_eq!(*info.key, anchor_spl::associated_token::get_associated_token_address(
                            &a.treasury.key(), &state.mint), BurnError::BadRoute);
                    }
                }
            }
        }
        require!(pool_count > 0, BurnError::UnapprovedPool);
        let before_base = a.base_ata.amount;
        let before_quote = a.quote_ata.amount;
        let bump = [ctx.bumps.treasury];
        let seeds: &[&[u8]] = &[b"treasury", &bump];
        invoke_signed(&system_instruction::transfer(&a.treasury.key(), &a.quote_ata.key(), input),
            &[a.treasury.to_account_info(), a.quote_ata.to_account_info(), a.system_program.to_account_info()], &[seeds])?;
        token::sync_native(CpiContext::new(a.token_program.to_account_info(), SyncNative { account: a.quote_ata.to_account_info() }))?;
        a.quote_ata.reload()?;
        // Preserve existing WSOL and any rent surplus released by SyncNative,
        // while requiring the AMM/router to consume exactly today's input.
        let expected_quote = a.quote_ata.amount.checked_sub(input).ok_or(BurnError::OutputInvariant)?;
        let metas = remaining.iter().map(|info| {
            let signer = *info.key == a.treasury.key();
            if info.is_writable { AccountMeta::new(*info.key, signer) }
            else { AccountMeta::new_readonly(*info.key, signer) }
        }).collect();
        let mut infos = remaining.to_vec();
        infos.push(a.jupiter_program.to_account_info());
        invoke_signed(&Instruction { program_id:JUPITER, accounts:metas, data:route_data }, &infos, &[seeds])?;
        a.base_ata.reload()?;a.quote_ata.reload()?;
        require_keys_eq!(*a.treasury.owner, anchor_lang::system_program::ID, BurnError::ReserveInvariant);
        require!(a.treasury.data_is_empty(), BurnError::ReserveInvariant);
        check_protocol_token(&a.base_ata, a.treasury.key())?;
        check_protocol_token(&a.quote_ata, a.treasury.key())?;
        let acquired = a.base_ata.amount.checked_sub(before_base).ok_or(BurnError::OutputInvariant)?;
        require!(acquired >= MIN_BASE_OUTPUT && a.quote_ata.amount == expected_quote
            && expected_quote >= before_quote, BurnError::OutputInvariant);
        let burned = burn_entire_dusd(&mut a.base_mint, &mut a.base_ata,
            a.treasury.to_account_info(), a.token_program.to_account_info(), ctx.bumps.treasury)?;
        require!(a.treasury.lamports() == treasury_before-input && a.treasury.lamports() >= floor, BurnError::ReserveInvariant);
        emit!(BurnReceipt {caller:a.caller.key(),input_lamports:input,acquired_raw:acquired,burned_raw:burned});
        Ok(())
    }
    pub fn execute_buy_and_burn(mut ctx: Context<BuyBurn>) -> Result<()> {
        require!(ctx.remaining_accounts.is_empty(), BurnError::UnexpectedAccounts);
        let a = &mut ctx.accounts;
        // Identity/ownership is fixed here; Pump validates the pool's internal
        // fields and supported trading modes. No local fee or reserve parser.
        check_discriminator(&a.pool, &[241,154,109,4,17,177,109,188])?;
        require!(a.treasury.data_is_empty(), BurnError::ReserveInvariant);
        require!(a.base_mint.decimals == 6 && a.base_mint.mint_authority.is_none() && a.base_mint.freeze_authority.is_none(), BurnError::BadMint);
        require!(a.base_vault.owner == POOL && a.quote_vault.owner == POOL, BurnError::BadVault);
        require!(a.base_vault.delegate.is_none() && a.quote_vault.delegate.is_none(), BurnError::BadVault);
        require!(a.base_ata.delegate.is_none() && a.base_ata.close_authority.is_none() && a.quote_ata.delegate.is_none() && a.quote_ata.close_authority.is_none(), BurnError::BadVault);
        // Discriminator and owner of the fixed global are checked before forwarding.
        check_discriminator(&a.global_config, &[149, 8, 156, 202, 160, 252, 176, 217])?;
        let floor = Rent::get()?.minimum_balance(0);
        let treasury_before = a.treasury.lamports();
        let input = treasury_before.checked_sub(floor).ok_or(BurnError::BelowThreshold)?;
        require!(input >= MIN_SPEND, BurnError::BelowThreshold);
        // Pump's idempotent extension uses the external caller, never treasury,
        // for any pool-account rent top-up. Pump chooses its required layout.
        let extend = Instruction { program_id: AMM, accounts: vec![
            AccountMeta::new(a.pool.key(), false), AccountMeta::new(a.caller.key(), true),
            AccountMeta::new_readonly(a.system_program.key(), false),
            AccountMeta::new_readonly(a.event_authority.key(), false), AccountMeta::new_readonly(AMM, false)],
            data: vec![234,102,194,203,150,72,62,229] };
        invoke(&extend, &[a.pool.to_account_info(), a.caller.to_account_info(), a.system_program.to_account_info(),
            a.event_authority.to_account_info(), a.amm_program.to_account_info()])?;
        // Allocate the AMM accumulator using caller rent, not treasury principal.
        if a.user_volume_accumulator.data_is_empty() {
            let ix = Instruction { program_id: AMM, accounts: vec![
                AccountMeta::new(a.caller.key(), true), AccountMeta::new_readonly(a.treasury.key(), false),
                AccountMeta::new(a.user_volume_accumulator.key(), false), AccountMeta::new_readonly(a.system_program.key(), false),
                AccountMeta::new_readonly(a.event_authority.key(), false), AccountMeta::new_readonly(AMM, false)],
                data: vec![94, 6, 202, 115, 255, 96, 232, 183] };
            invoke(&ix, &[a.caller.to_account_info(), a.treasury.to_account_info(), a.user_volume_accumulator.to_account_info(),
                a.system_program.to_account_info(), a.event_authority.to_account_info(), a.amm_program.to_account_info()])?;
        }
        require_keys_eq!(*a.user_volume_accumulator.owner, AMM, BurnError::BadAccumulator);
        check_discriminator(&a.user_volume_accumulator,&[86,255,112,14,102,53,154,250])?;
        { let data=a.user_volume_accumulator.try_borrow_data()?;
          require!(data.len()>=40 && data[8..40]==a.treasury.key().to_bytes(), BurnError::BadAccumulator); }
        let before_base = a.base_ata.amount;
        let before_quote = a.quote_ata.amount;
        let bump = [ctx.bumps.treasury];
        let seeds: &[&[u8]] = &[b"treasury", &bump];
        invoke_signed(&system_instruction::transfer(&a.treasury.key(), &a.quote_ata.key(), input),
            &[a.treasury.to_account_info(), a.quote_ata.to_account_info(), a.system_program.to_account_info()], &[seeds])?;
        token::sync_native(CpiContext::new(a.token_program.to_account_info(), SyncNative { account: a.quote_ata.to_account_info() }))?;
        a.quote_ata.reload()?;
        let expected_quote = a.quote_ata.amount.checked_sub(input).ok_or(BurnError::OutputInvariant)?;
        let infos = vec![a.pool.to_account_info(), a.treasury.to_account_info(), a.global_config.to_account_info(),
            a.base_mint.to_account_info(), a.quote_mint.to_account_info(), a.base_ata.to_account_info(), a.quote_ata.to_account_info(),
            a.base_vault.to_account_info(), a.quote_vault.to_account_info(), a.token_program.to_account_info(), a.token_program.to_account_info(),
            a.system_program.to_account_info(), a.user_volume_accumulator.to_account_info(), a.fee_config.to_account_info(),
            a.buyback_fee_recipient.to_account_info(), a.event_authority.to_account_info(), a.amm_program.to_account_info()];
        let writable = [0usize,1,5,6,7,8,12,14];
        let metas = infos.iter().enumerate().map(|(i, info)| if writable.contains(&i) {AccountMeta::new(*info.key, i==1)} else {AccountMeta::new_readonly(*info.key, i==1)}).collect();
        let mut data=vec![194,171,28,70,104,77,91,47];
        data.extend_from_slice(&input.to_le_bytes());data.extend_from_slice(&MIN_BASE_OUTPUT.to_le_bytes());
        invoke_signed(&Instruction {program_id:AMM,accounts:metas,data}, &infos, &[seeds])?;
        a.base_ata.reload()?;a.quote_ata.reload()?;
        // Local review candidate only: protect protocol-owned custody after CPI.
        require_keys_eq!(*a.treasury.owner, anchor_lang::system_program::ID, BurnError::ReserveInvariant);
        require!(a.treasury.data_is_empty(), BurnError::ReserveInvariant);
        require!(a.base_ata.owner == a.treasury.key() && a.quote_ata.owner == a.treasury.key(), BurnError::BadVault);
        require!(a.base_ata.delegate.is_none() && a.base_ata.close_authority.is_none()
            && a.quote_ata.delegate.is_none() && a.quote_ata.close_authority.is_none(), BurnError::BadVault);
        let acquired=a.base_ata.amount.checked_sub(before_base).ok_or(BurnError::OutputInvariant)?;
        require!(acquired >= MIN_BASE_OUTPUT && a.quote_ata.amount == expected_quote
            && expected_quote >= before_quote, BurnError::OutputInvariant);
        // All DUSD in this designated account is protocol burn inventory,
        // including pre-existing balances and voluntary donations.
        let burn_amount=burn_entire_dusd(&mut a.base_mint, &mut a.base_ata,
            a.treasury.to_account_info(), a.token_program.to_account_info(), ctx.bumps.treasury)?;
        require!(a.treasury.lamports() >= floor && a.treasury.lamports() == treasury_before-input, BurnError::ReserveInvariant);
        emit!(BurnReceipt { caller:a.caller.key(), input_lamports:input, acquired_raw:acquired, burned_raw:burn_amount });
        Ok(())
    }
    pub fn burn_dusd(ctx: Context<BurnDusd>) -> Result<()> {
        require!(ctx.remaining_accounts.is_empty(), BurnError::UnexpectedAccounts);
        let a=ctx.accounts;
        require!(a.base_mint.decimals == 6 && a.base_mint.mint_authority.is_none() && a.base_mint.freeze_authority.is_none(), BurnError::BadMint);
        require!(a.base_ata.delegate.is_none() && a.base_ata.close_authority.is_none(), BurnError::BadVault);
        let burned=burn_entire_dusd(&mut a.base_mint, &mut a.base_ata,
            a.treasury.to_account_info(), a.token_program.to_account_info(), ctx.bumps.treasury)?;
        emit!(DusdBurnReceipt {caller:a.caller.key(),burned_raw:burned});
        Ok(())
    }
    // Internal WSOL recovery only: fixed ATA -> same treasury. Cannot withdraw
    // to a caller, and does not spend SOL or buy anything below the burn threshold.
    pub fn unwrap_quote(ctx: Context<UnwrapQuote>) -> Result<()> {
        require!(ctx.remaining_accounts.is_empty(), BurnError::UnexpectedAccounts);
        // Do not allow arbitrary callers to close an empty/dust ATA repeatedly
        // and force every burn caller to pay fresh setup rent.
        require!(ctx.accounts.quote_ata.amount >= MIN_SPEND, BurnError::BelowThreshold);
        let bump=[ctx.bumps.treasury];let seeds: &[&[u8]]=&[b"treasury",&bump];
        token::close_account(CpiContext::new_with_signer(ctx.accounts.token_program.to_account_info(), CloseAccount {
            account:ctx.accounts.quote_ata.to_account_info(), destination:ctx.accounts.treasury.to_account_info(),
            authority:ctx.accounts.treasury.to_account_info()}, &[seeds]))
    }
}

fn check_protocol_token(account: &TokenAccount, authority: Pubkey) -> Result<()> {
    require_keys_eq!(account.owner, authority, BurnError::BadVault);
    require!(account.delegate.is_none() && account.close_authority.is_none(), BurnError::BadVault);
    Ok(())
}

#[derive(Accounts)]
pub struct JupiterBuyBurn<'info> {
    #[account(mut)] pub caller: Signer<'info>,
    #[account(mut,seeds=[b"treasury"],bump)] pub treasury: SystemAccount<'info>,
    #[account(mut,address=DUSD)] pub base_mint: Box<Account<'info,Mint>>,
    #[account(address=NATIVE)] pub quote_mint: Box<Account<'info,Mint>>,
    #[account(init_if_needed,payer=caller,associated_token::mint=base_mint,associated_token::authority=treasury)]
    pub base_ata: Box<Account<'info,TokenAccount>>,
    #[account(init_if_needed,payer=caller,associated_token::mint=quote_mint,associated_token::authority=treasury)]
    pub quote_ata: Box<Account<'info,TokenAccount>>,
    pub token_program: Program<'info,Token>,
    pub system_program: Program<'info,System>,
    pub associated_token_program: Program<'info,AssociatedToken>,
    /// CHECK: fixed executable router, never caller-selected.
    #[account(address=JUPITER,executable)] pub jupiter_program: UncheckedAccount<'info>,
}

// Shared policy: zero is a harmless no-op; positive balance is burned in full.
// The account structs, not caller arguments, fix mint, source and PDA authority.
fn burn_entire_dusd<'info>(mint:&mut Account<'info,Mint>, source:&mut Account<'info,TokenAccount>,
    treasury:AccountInfo<'info>, token_program:AccountInfo<'info>, bump:u8)->Result<u64> {
    let amount=source.amount;
    if amount==0 {return Ok(0);}
    let supply=mint.supply;
    let bump_seed=[bump];let seeds:&[&[u8]]=&[b"treasury",&bump_seed];
    token::burn(CpiContext::new_with_signer(token_program, Burn {
        mint:mint.to_account_info(),from:source.to_account_info(),authority:treasury}, &[seeds]), amount)?;
    source.reload()?;mint.reload()?;
    require!(source.amount==0 && supply.checked_sub(amount)==Some(mint.supply), BurnError::BurnInvariant);
    Ok(amount)
}

#[derive(Accounts)]
pub struct BurnDusd<'info> {
    pub caller: Signer<'info>,
    /// CHECK: identity-only canonical PDA authority; need not exist or hold SOL.
    #[account(seeds=[b"treasury"],bump)] pub treasury: UncheckedAccount<'info>,
    #[account(mut,address=DUSD)] pub base_mint: Box<Account<'info,Mint>>,
    #[account(mut,associated_token::mint=base_mint,associated_token::authority=treasury)]
    pub base_ata: Box<Account<'info,TokenAccount>>,
    pub token_program: Program<'info,Token>,
}

#[derive(Accounts)]
pub struct BuyBurn<'info> {
    #[account(mut)] pub caller: Signer<'info>,
    #[account(mut, seeds=[b"treasury"], bump)] pub treasury: SystemAccount<'info>,
    /// CHECK: immutable canonical address, AMM owner and discriminator; Pump checks internal fields.
    #[account(mut,address=POOL,owner=AMM)] pub pool: UncheckedAccount<'info>,
    /// CHECK: fixed PDA + program ownership + discriminator, Pump enforces its enabled flags.
    #[account(address=GLOBAL,owner=AMM)] pub global_config: UncheckedAccount<'info>,
    #[account(mut,address=DUSD)] pub base_mint: Box<Account<'info,Mint>>,
    #[account(address=NATIVE)] pub quote_mint: Box<Account<'info,Mint>>,
    #[account(init_if_needed,payer=caller,associated_token::mint=base_mint,associated_token::authority=treasury)]
    pub base_ata: Box<Account<'info,TokenAccount>>,
    #[account(init_if_needed,payer=caller,associated_token::mint=quote_mint,associated_token::authority=treasury)]
    pub quote_ata: Box<Account<'info,TokenAccount>>,
    #[account(mut,address=BASE_VAULT,token::mint=base_mint)] pub base_vault: Box<Account<'info,TokenAccount>>,
    #[account(mut,address=QUOTE_VAULT,token::mint=quote_mint)] pub quote_vault: Box<Account<'info,TokenAccount>>,
    pub token_program: Program<'info,Token>,
    pub system_program: Program<'info,System>,
    /// CHECK: exact Pump PDA. Pump creates it caller-funded; owner checked after creation.
    #[account(mut,seeds=[b"user_volume_accumulator",treasury.key().as_ref()],bump,seeds::program=AMM)]
    pub user_volume_accumulator: UncheckedAccount<'info>,
    /// CHECK: fixed owner/address; Pump alone deserializes and validates fee configuration.
    #[account(address=FEE_CONFIG,owner=FEES)] pub fee_config: UncheckedAccount<'info>,
    // Pump verifies membership in GlobalConfig's current buyback recipient set.
    // This is a protocol-fee account, never the DUSD output destination.
    #[account(mut,token::mint=quote_mint)] pub buyback_fee_recipient: Box<Account<'info,TokenAccount>>,
    /// CHECK: exact external event PDA, never a spend destination.
    #[account(seeds=[b"__event_authority"],bump,seeds::program=AMM)] pub event_authority: UncheckedAccount<'info>,
    /// CHECK: fixed executable; no caller-selected CPI program.
    #[account(address=AMM,executable)] pub amm_program: UncheckedAccount<'info>,
    pub associated_token_program: Program<'info,AssociatedToken>,
}
#[derive(Accounts)]
pub struct UnwrapQuote<'info> {
    pub caller: Signer<'info>,
    #[account(mut,seeds=[b"treasury"],bump)] pub treasury: SystemAccount<'info>,
    #[account(address=NATIVE)] pub quote_mint: Account<'info,Mint>,
    #[account(mut,associated_token::mint=quote_mint,associated_token::authority=treasury)] pub quote_ata: Account<'info,TokenAccount>,
    pub token_program: Program<'info,Token>,
}
fn check_discriminator(account:&AccountInfo,expected:&[u8;8])->Result<()> {
    let data=account.try_borrow_data()?;require!(data.len()>=8 && &data[..8]==expected, BurnError::BadDiscriminator);Ok(())
}
#[event]
pub struct BurnReceipt {pub caller:Pubkey,pub input_lamports:u64,pub acquired_raw:u64,pub burned_raw:u64}
#[event]
pub struct DusdBurnReceipt {pub caller:Pubkey,pub burned_raw:u64}
#[error_code]
pub enum BurnError {
    #[msg("Unexpected remaining accounts")] UnexpectedAccounts,
    #[msg("Wrong or unsafe mint")] BadMint,
    #[msg("Unsafe token account")] BadVault,
    #[msg("Wrong user accumulator owner")] BadAccumulator,
    #[msg("Less than 0.01 SOL spendable above rent")] BelowThreshold,
    #[msg("Swap output invariant failed")] OutputInvariant,
    #[msg("Atomic burn invariant failed")] BurnInvariant,
    #[msg("Treasury reserve invariant failed")] ReserveInvariant,
    #[msg("Wrong account discriminator")] BadDiscriminator,
    #[msg("Invalid Jupiter route or account privileges")] BadRoute,
    #[msg("Route contains a pool outside the immutable allowlist")] UnapprovedPool,
}
