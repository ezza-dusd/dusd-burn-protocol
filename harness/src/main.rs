//! LOCAL in-memory Solana VM. Real SBF programs; no network client or key loading.
use std::{fs,io::{self,BufRead,Write},str::FromStr};
use litesvm::LiteSVM;
use solana_address::Address;
use solana_account::Account;
use solana_transaction::versioned::VersionedTransaction;
use solana_rent::Rent;
use serde_json::{Value,json};
use base64::{Engine,engine::general_purpose::STANDARD};
fn address(s:&str)->Address {Address::from_str(s).expect("valid public address")}
fn account_json(a:Option<Account>)->Value {
 match a {None=>Value::Null,Some(a)=>json!({"lamports":a.lamports,"owner":a.owner.to_string(),"data":[STANDARD.encode(&a.data),"base64"],"executable":a.executable,"rentEpoch":0,"space":a.data.len()})}
}
fn run()->Result<(),Box<dyn std::error::Error>> {
 let root=std::env::args().nth(1).ok_or("sandbox root required")?;
 let mut svm=LiteSVM::new();
 let inventory:Value=serde_json::from_slice(&fs::read(format!("{root}/research/onchain-inventory.json"))?)?;
 // Match the observed mainnet rent sysvar, rather than the local CLI's older default.
 let rent_json:Value=serde_json::from_slice(&fs::read(format!("{root}/research/rent-sysvar.json"))?)?;
 let rent_bytes=STANDARD.decode(rent_json["value"][0]["data"][0].as_str().unwrap())?;
 #[allow(deprecated)]
 let rent=Rent {lamports_per_byte:u64::from_le_bytes(rent_bytes[0..8].try_into()?),exemption_threshold:rent_bytes[8..16].try_into()?,burn_percent:rent_bytes[16]};
 svm.set_sysvar(&rent);
 assert_eq!(rent.minimum_balance(0),inventory["rent"]["0"].as_u64().unwrap());
 for name in ["pumpProgram","ammProgram","feesProgram"] {
  let id=address(inventory["addresses"][name].as_str().unwrap());svm.add_program_from_file(id,format!("{root}/fixtures/programs/{name}.so"))?;
 }
 // Local test inventory may explicitly select the release program ID.
 let burn_id=inventory["addresses"]["burnProgram"].as_str().unwrap_or("Cfd92kkjkkw7oyZN6ZwRDJBCSSUjmALzp9EgDararj7s");
 svm.add_program_from_file(address(burn_id),format!("{root}/target/deploy/dusd_burn.so"))?;
 if let Ok(bytes)=fs::read(format!("{root}/additional-programs.json")) {
  let programs:Value=serde_json::from_slice(&bytes)?;
  for p in programs.as_array().ok_or("invalid additional program list")? {
   svm.add_program_from_file(address(p["address"].as_str().ok_or("program address")?),
      format!("{root}/fixtures/programs/{}",p["file"].as_str().ok_or("program file")?))?;
  }
 }
 if let Ok(bytes)=fs::read(format!("{root}/runtime-clock.json")) {
  let c:Value=serde_json::from_slice(&bytes)?;
  let mut clock=svm.get_sysvar::<solana_clock::Clock>();
  clock.slot=c["slot"].as_u64().ok_or("clock slot")?;
  clock.epoch=c["epoch"].as_u64().ok_or("clock epoch")?;
  clock.epoch_start_timestamp=c["epochStartTimestamp"].as_i64().ok_or("clock epoch start")?;
  clock.leader_schedule_epoch=c["leaderScheduleEpoch"].as_u64().ok_or("clock leader epoch")?;
  clock.unix_timestamp=c["unixTimestamp"].as_i64().ok_or("clock time")?;
  svm.set_sysvar(&clock);
 }
 for file in fs::read_dir(format!("{root}/fixtures/accounts"))? {
  let path=file?.path();if path.extension().and_then(|s|s.to_str())!=Some("json"){continue;}
  let v:Value=serde_json::from_slice(&fs::read(path)?)?;let a=&v["account"];
  svm.set_account(address(v["pubkey"].as_str().unwrap()),Account {lamports:a["lamports"].as_u64().unwrap(),data:STANDARD.decode(a["data"][0].as_str().unwrap())?,
   owner:address(a["owner"].as_str().unwrap()),executable:a["executable"].as_bool().unwrap(),rent_epoch:0})?;
 }
 println!("{}",json!({"ready":true,"engine":"LiteSVM 0.18.0","blockhash":svm.latest_blockhash().to_string()}));io::stdout().flush()?;
 for line in io::stdin().lock().lines(){
  let v:Value=serde_json::from_str(&line?)?;
  let result=match v["method"].as_str().unwrap_or("") {
   "accounts"=>json!(v["addresses"].as_array().unwrap().iter().map(|p|account_json(svm.get_account(&address(p.as_str().unwrap())))).collect::<Vec<_>>()),
   "rent"=>json!(rent.minimum_balance(v["bytes"].as_u64().unwrap() as usize)),
   "blockhash"=>json!(svm.latest_blockhash().to_string()),
   "airdrop"=>{
     let r=svm.airdrop(&address(v["address"].as_str().unwrap()),v["lamports"].as_u64().unwrap());
     svm.expire_blockhash();
     match r {Ok(m)=>json!({"signature":m.signature.to_string(),"error":null,"fee":m.fee,"computeUnits":m.compute_units_consumed,"logs":m.logs}),Err(e)=>json!({"error":e.err,"logs":e.meta.logs})}
   },
   "send"=>{
    let bytes=STANDARD.decode(v["transaction"].as_str().unwrap())?;
    let tx:VersionedTransaction=wincode::deserialize(&bytes)?;
    let r=svm.send_transaction(tx);svm.expire_blockhash();
    match r {Ok(m)=>json!({"signature":m.signature.to_string(),"error":null,"fee":m.fee,"computeUnits":m.compute_units_consumed,"logs":m.logs}),Err(e)=>json!({"signature":e.meta.signature.to_string(),"error":e.err,"fee":e.meta.fee,"computeUnits":e.meta.compute_units_consumed,"logs":e.meta.logs})}
   },
   _=>json!({"error":"unsupported local harness method"})
  };
  println!("{}",json!({"id":v["id"],"result":result}));io::stdout().flush()?;
 }
 Ok(())
}
fn main(){if let Err(e)=run(){eprintln!("Local VM failure: {e}");std::process::exit(1)}}
