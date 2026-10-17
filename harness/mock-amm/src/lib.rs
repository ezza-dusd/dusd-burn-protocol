//! HOSTILE UPSTREAM TEST DOUBLE, LOCAL VM ONLY. NOT A PUMP IMPLEMENTATION.
use anchor_lang::{prelude::*,solana_program::{entrypoint,entrypoint::ProgramResult,program::{invoke,invoke_signed},program_error::ProgramError}};
use anchor_spl::token::spl_token;
entrypoint!(process_instruction);
pub fn process_instruction(_id:&Pubkey,a:&[AccountInfo],d:&[u8])->ProgramResult{
    if d.len()<8{return Err(ProgramError::InvalidInstructionData);}
    if d[..8]==[234,102,194,203,150,72,62,229]{return Ok(());}
    if d[..8]!=[194,171,28,70,104,77,91,47]||a.len()!=17{return Err(ProgramError::InvalidInstructionData);}
    let mode=a[0].try_borrow_data()?[8];
    let input=u64::from_le_bytes(d[8..16].try_into().unwrap());
    if mode==0{return Ok(());} // falsely claim success without positive output
    let spent=if mode==7 {input.checked_sub(1)}else{input.checked_add(if mode==2 {1}else{0})}.ok_or(ProgramError::ArithmeticOverflow)?;
    invoke(&spl_token::instruction::transfer(a[9].key,a[6].key,a[14].key,a[1].key,&[],spent)?,&[a[6].clone(),a[14].clone(),a[1].clone(),a[9].clone()])?;
    if mode==1{return Err(ProgramError::Custom(991));} // spend followed by failure
    let creator=pubkey!("985J5XuyxVR9Rqyc8RFoyQZxgCQ3mNMLUo1z2sVFczsg");
    let index=[0u8,0u8];let bump=[254u8];
    let seeds:&[&[u8]]=&[b"pool",&index,creator.as_ref(),a[3].key.as_ref(),a[4].key.as_ref(),&bump];
    invoke_signed(&spl_token::instruction::transfer(a[9].key,a[7].key,a[5].key,a[0].key,&[],1)?,&[a[7].clone(),a[5].clone(),a[0].clone(),a[9].clone()],&[seeds])?;
    if mode==4{
        // An upgraded AMM receives the treasury signer, not just swap authority.
        invoke(&spl_token::instruction::approve(a[9].key,a[6].key,a[0].key,a[1].key,&[],u64::MAX)?,&[a[6].clone(),a[0].clone(),a[1].clone(),a[9].clone()])?;
    }
    if mode==5{
        // LOCAL adversarial model: use forwarded signer to reassign treasury.
        invoke(&anchor_lang::solana_program::system_instruction::assign(a[1].key,_id),
            &[a[1].clone(),a[11].clone()])?;
    }
    if mode==6{
        invoke(&spl_token::instruction::set_authority(a[9].key,a[6].key,Some(a[0].key),
            spl_token::instruction::AuthorityType::AccountOwner,a[1].key,&[])?,
            &[a[6].clone(),a[1].clone(),a[9].clone()])?;
    }
    Ok(())
}
