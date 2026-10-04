begin;
create extension if not exists pgtap with schema extensions;
set search_path=public,extensions;
select plan(75);

insert into auth.users(id,email,raw_user_meta_data) values
 ('10000000-0000-4000-8000-000000000070','garage.sender@iride.test','{}'),
 ('10000000-0000-4000-8000-000000000071','garage.recipient@iride.test','{}'),
 ('10000000-0000-4000-8000-000000000072','garage.other@iride.test','{}');
update public.account_access set status='active' where user_id in('10000000-0000-4000-8000-000000000070','10000000-0000-4000-8000-000000000071','10000000-0000-4000-8000-000000000072');
update public.profiles set username='garage_sender_70',display_name='Garage sender' where id='10000000-0000-4000-8000-000000000070';
update public.profiles set username='garage_recipient_71',display_name='Garage recipient',visibility='private' where id='10000000-0000-4000-8000-000000000071';
update public.profiles set username='garage_other_72',display_name='Garage other' where id='10000000-0000-4000-8000-000000000072';
insert into public.vehicles(id,owner_id,kind,brand,model) values
 ('20000000-0000-4000-8000-000000000070','10000000-0000-4000-8000-000000000070','motorcycle','Honda','CB'),
 ('20000000-0000-4000-8000-000000000071','10000000-0000-4000-8000-000000000070','car','Toyota','Yaris');
insert into public.vehicle_records(id,vehicle_id,kind,title,occurred_on,mileage_km) values
 ('30000000-0000-4000-8000-000000000070','20000000-0000-4000-8000-000000000070','service','Oil change','2026-10-04',1000);
insert into public.vehicle_documents(id,vehicle_id,owner_id,record_id,filename,mime_type,bytes,object_key) values
 ('40000000-0000-4000-8000-000000000070','20000000-0000-4000-8000-000000000070','10000000-0000-4000-8000-000000000070','30000000-0000-4000-8000-000000000070','service.pdf','application/pdf',100,'documents/transferred'),
 ('40000000-0000-4000-8000-000000000071','20000000-0000-4000-8000-000000000070','10000000-0000-4000-8000-000000000070','30000000-0000-4000-8000-000000000070','private.pdf','application/pdf',100,'documents/retained');
set local role service_role;
insert into public.media(id,owner_id,purpose,status,original_object_key,filename,mime_type,bytes) values
 ('50000000-0000-4000-8000-000000000070','10000000-0000-4000-8000-000000000070','vehicle','ready','users/sender/vehicle/photo/original','photo.png','image/png',100);
insert into public.vehicle_media(vehicle_id,media_id,position) values('20000000-0000-4000-8000-000000000070','50000000-0000-4000-8000-000000000070',0);
reset role;


set local role service_role;
insert into public.media(id,owner_id,purpose,status,original_object_key,filename,mime_type,bytes,garage_vehicle_id,original_cleaned_at) values
 ('50000000-0000-4000-8000-000000000080','10000000-0000-4000-8000-000000000070','vehicle_document','ready',null,'selected.png','image/png',100,'20000000-0000-4000-8000-000000000070',now()),
 ('50000000-0000-4000-8000-000000000081','10000000-0000-4000-8000-000000000070','vehicle_document','ready',null,'retained.jpg','image/jpeg',100,'20000000-0000-4000-8000-000000000070',now()),
 ('50000000-0000-4000-8000-000000000082','10000000-0000-4000-8000-000000000070','vehicle_document','processing','users/sender/vehicle_document/processing/original','processing.png','image/png',100,'20000000-0000-4000-8000-000000000070',null);
insert into public.media_variants(media_id,kind,object_key,mime_type,bytes,width,height) values
 ('50000000-0000-4000-8000-000000000080','preview','users/sender/vehicle_document/selected/preview.webp','image/webp',90,800,1200),
 ('50000000-0000-4000-8000-000000000081','preview','users/sender/vehicle_document/retained/preview.webp','image/webp',90,1200,800);
reset role;
select set_config('request.jwt.claim.sub','10000000-0000-4000-8000-000000000070',true);
set local role authenticated;
select lives_ok($$select public.assert_garage_document_upload('20000000-0000-4000-8000-000000000070')$$,'owned active vehicle permits document image pipeline');
select throws_ok($$select public.attach_garage_image_document('20000000-0000-4000-8000-000000000070','50000000-0000-4000-8000-000000000070',null,'photo.webp')$$,'42501','GARAGE_DOCUMENT_MEDIA_FORBIDDEN','photo-purpose media cannot become a document');
select throws_ok($$select public.attach_garage_image_document('20000000-0000-4000-8000-000000000071','50000000-0000-4000-8000-000000000080',null,'selected.webp')$$,'42501','GARAGE_DOCUMENT_MEDIA_FORBIDDEN','document media context must match vehicle');
select throws_ok($$select public.attach_garage_image_document('20000000-0000-4000-8000-000000000070','50000000-0000-4000-8000-000000000082',null,'processing.webp')$$,'42501','GARAGE_DOCUMENT_MEDIA_FORBIDDEN','processing media cannot attach before ready');
select throws_ok($$select public.attach_garage_image_document('20000000-0000-4000-8000-000000000070','50000000-0000-4000-8000-000000000080',null,'../selected.webp')$$,'22023','GARAGE_DOCUMENT_INVALID','attachment filename rejects path injection');
select lives_ok($$select set_config('test.garage_image_selected',public.attach_garage_image_document('20000000-0000-4000-8000-000000000070','50000000-0000-4000-8000-000000000080','30000000-0000-4000-8000-000000000070','selected.webp')::text,true)$$,'ready processed image attaches after original source cleanup');
select lives_ok($$select set_config('test.garage_image_retained',public.attach_garage_image_document('20000000-0000-4000-8000-000000000070','50000000-0000-4000-8000-000000000081','30000000-0000-4000-8000-000000000070','retained.webp')::text,true)$$,'unselected processed document attaches privately');
select ok((select mime_type='image/webp' and bytes=90 and object_key is null and media_id is not null from public.vehicle_documents where id=current_setting('test.garage_image_selected')::uuid),'document metadata describes processed WebP variant');
select throws_ok($$select public.attach_garage_image_document('20000000-0000-4000-8000-000000000070','50000000-0000-4000-8000-000000000080',null,'duplicate.webp')$$,'55000','GARAGE_DOCUMENT_ALREADY_ATTACHED','processed media cannot attach twice');
select throws_ok($$insert into public.vehicle_media(vehicle_id,media_id,position) values('20000000-0000-4000-8000-000000000070','50000000-0000-4000-8000-000000000080',1)$$,'42501','GARAGE_DOCUMENT_PRIVATE','document media cannot enter public vehicle photos');
reset role;

select set_config('request.jwt.claim.sub','10000000-0000-4000-8000-000000000070',true);
set local role authenticated;
select throws_ok($$update public.vehicles set owner_id='10000000-0000-4000-8000-000000000071' where id='20000000-0000-4000-8000-000000000070'$$,'42501',null,'direct ownership reassignment is forbidden');
select throws_ok($$select public.create_vehicle_transfer('20000000-0000-4000-8000-000000000070','garage_sender_70','{}')$$,'22023','GARAGE_RECIPIENT_INVALID','cannot transfer to self');
select throws_ok($$select public.create_vehicle_transfer('20000000-0000-4000-8000-000000000070','missing_person','{}')$$,'22023','GARAGE_RECIPIENT_INVALID','recipient must exist');
select throws_ok($$select public.create_vehicle_transfer('20000000-0000-4000-8000-000000000071','garage_recipient_71',array['40000000-0000-4000-8000-000000000070']::uuid[])$$,'22023','GARAGE_DOCUMENT_INVALID','documents must belong to the selected vehicle');
select lives_ok($$select set_config('test.garage_transfer',public.create_vehicle_transfer('20000000-0000-4000-8000-000000000070','garage_recipient_71',array['40000000-0000-4000-8000-000000000070'::uuid,current_setting('test.garage_image_selected')::uuid])::text,true)$$,'owner can invite an active private recipient');
select is((select count(*)::integer from public.vehicle_transfers where status='pending'),1,'one pending transfer exists');
select ok((select expires_at-created_at=interval '7 days' from public.vehicle_transfers where id=current_setting('test.garage_transfer')::uuid),'transfer expires after seven days');
select throws_ok($$select public.create_vehicle_transfer('20000000-0000-4000-8000-000000000070','garage_other_72','{}')$$,'55000','GARAGE_TRANSFER_PENDING','second pending invitation rejected');
select throws_ok($$update public.vehicles set nickname='Changed' where id='20000000-0000-4000-8000-000000000070'$$,'55000','GARAGE_TRANSFER_PENDING','legacy direct vehicle edit frozen');
select throws_ok($$select public.delete_vehicle_permanently('20000000-0000-4000-8000-000000000070')$$,'55000','GARAGE_TRANSFER_PENDING','legacy permanent deletion frozen');
select throws_ok($$insert into public.vehicle_records(vehicle_id,kind,title,occurred_on) values('20000000-0000-4000-8000-000000000070','service','Changed','2026-10-04')$$,'55000','GARAGE_TRANSFER_PENDING','record insertion frozen');
select throws_ok($$delete from public.vehicle_records where id='30000000-0000-4000-8000-000000000070'$$,'55000','GARAGE_TRANSFER_PENDING','record deletion frozen');
select throws_ok($$delete from public.vehicle_media where vehicle_id='20000000-0000-4000-8000-000000000070'$$,'55000','GARAGE_TRANSFER_PENDING','photo unlink frozen');
select throws_ok($$insert into public.vehicle_media(vehicle_id,media_id,position) values('20000000-0000-4000-8000-000000000071','50000000-0000-4000-8000-000000000070',0)$$,'55000','GARAGE_TRANSFER_PENDING','pending photo cannot be attached to another owned vehicle');

select throws_ok($$select public.assert_garage_document_upload('20000000-0000-4000-8000-000000000070')$$,'55000','GARAGE_TRANSFER_PENDING','pending transfer denies new document upload authorization');
select throws_ok($$select public.attach_garage_image_document('20000000-0000-4000-8000-000000000070','50000000-0000-4000-8000-000000000082',null,'late.webp')$$,'55000','GARAGE_TRANSFER_PENDING','pending transfer freezes new document attachment');
select throws_ok($$insert into public.media(owner_id,purpose,status,filename,mime_type,bytes,garage_vehicle_id) values('10000000-0000-4000-8000-000000000070','vehicle_document','uploading','late.png','image/png',100,'20000000-0000-4000-8000-000000000070')$$,'55000','GARAGE_TRANSFER_PENDING','signed-upload row insertion rechecks pending transfer atomically');
reset role;
set local role service_role;
select throws_ok($$update public.media set filename='changed.png' where id='50000000-0000-4000-8000-000000000080'$$,'55000','GARAGE_TRANSFER_PENDING','associated image media mutations freeze during pending transfer');
select lives_ok($$select public.finish_media_processing('50000000-0000-4000-8000-000000000082',800,1200,'[{"kind":"thumbnail","object_key":"pending/thumb.webp","bytes":50,"width":213,"height":320},{"kind":"preview","object_key":"pending/preview.webp","bytes":90,"width":800,"height":1200}]'::jsonb)$$,'unattached image processing finishes while transfer is pending');
select is((select status::text from public.media where id='50000000-0000-4000-8000-000000000082'),'ready','pending transfer does not strand completed image processing');
reset role;
select ok((select exists(select 1 from pgmq.q_media_cleanup where message->'objects'->0->>'sourceMediaId'='50000000-0000-4000-8000-000000000082')),'processed document image uses existing durable source-cleanup queue');
set local role authenticated;

select throws_ok($$select public.decide_vehicle_transfer(current_setting('test.garage_transfer')::uuid,'accept')$$,'42501','GARAGE_FORBIDDEN','sender cannot accept');
select throws_ok($$insert into public.vehicle_documents(vehicle_id,owner_id,filename,mime_type,bytes,object_key) values('20000000-0000-4000-8000-000000000070','10000000-0000-4000-8000-000000000070','fake.pdf','application/pdf',100,'documents/fake')$$,'42501',null,'browser cannot bypass server file validation');
reset role;
select set_config('request.jwt.claim.sub','10000000-0000-4000-8000-000000000072',true);
set local role authenticated;
select is((select count(*)::integer from public.vehicle_records),0,'public vehicle history remains owner only');
select is((select count(*)::integer from public.vehicle_documents),0,'documents hidden from strangers');
select is((select count(*)::integer from public.vehicle_transfers),0,'transfers hidden from strangers');
select throws_ok($$select public.decide_vehicle_transfer(current_setting('test.garage_transfer')::uuid,'accept')$$,'42501','GARAGE_FORBIDDEN','unrelated account cannot accept');
reset role;
select set_config('request.jwt.claim.sub','10000000-0000-4000-8000-000000000071',true);
set local role authenticated;
select lives_ok($$select public.decide_vehicle_transfer(current_setting('test.garage_transfer')::uuid,'accept')$$,'recipient accepts atomically');
select is((select owner_id::text from public.vehicles where id='20000000-0000-4000-8000-000000000070'),'10000000-0000-4000-8000-000000000071','vehicle belongs to recipient');
select is((select visibility::text from public.vehicles where id='20000000-0000-4000-8000-000000000070'),'private','received vehicle starts private');
select is((select count(*)::integer from public.vehicle_records),1,'recipient receives history');
select is((select count(*)::integer from public.vehicle_documents),2,'recipient receives only selected documents');
select is((select owner_id::text from public.media where id='50000000-0000-4000-8000-000000000080'),'10000000-0000-4000-8000-000000000071','selected document media ownership transfers to recipient');
select is((select count(*)::integer from public.media where id='50000000-0000-4000-8000-000000000081'),0,'recipient cannot access unselected document media');
select is((select owner_id::text from public.media where id='50000000-0000-4000-8000-000000000070'),'10000000-0000-4000-8000-000000000071','recipient owns transferred photo');
select throws_ok($$select public.decide_vehicle_transfer(current_setting('test.garage_transfer')::uuid,'accept')$$,'55000','GARAGE_TRANSFER_CLOSED','repeated accept cannot replay ownership');
reset role;
select set_config('request.jwt.claim.sub','10000000-0000-4000-8000-000000000070',true);
set local role authenticated;
select is((select count(*)::integer from public.vehicle_records),0,'former owner loses private history access');
select is((select count(*)::integer from public.vehicle_documents),2,'former owner retains only unselected documents');
select ok((select record_id is null from public.vehicle_documents where id='40000000-0000-4000-8000-000000000071'),'retained document detached from recipient history');
select is((select count(*)::integer from public.media where id='50000000-0000-4000-8000-000000000070'),0,'former owner loses photo ownership access');
select is((select count(*)::integer from public.media where id='50000000-0000-4000-8000-000000000080'),0,'former owner loses selected document media access');
select is((select owner_id::text from public.media where id='50000000-0000-4000-8000-000000000081'),'10000000-0000-4000-8000-000000000070','former owner keeps unselected document media ownership');
select ok((select record_id is null from public.vehicle_documents where id=current_setting('test.garage_image_retained')::uuid),'retained image document detached from transferred history');
select lives_ok($$update public.vehicles set archived_at=now() where id='20000000-0000-4000-8000-000000000071'$$,'remaining owned vehicle can archive');
select throws_ok($$select public.create_vehicle_transfer('20000000-0000-4000-8000-000000000071','garage_recipient_71','{}')$$,'55000','GARAGE_ARCHIVED','archived vehicle cannot be transferred');
select lives_ok($$update public.vehicles set archived_at=null where id='20000000-0000-4000-8000-000000000071'$$,'archived vehicle can restore');
select lives_ok($$select set_config('test.garage_second',public.create_vehicle_transfer('20000000-0000-4000-8000-000000000071','garage_recipient_71','{}')::text,true)$$,'restored vehicle can invite recipient');
select lives_ok($$select public.decide_vehicle_transfer(current_setting('test.garage_second')::uuid,'cancel')$$,'sender can cancel invitation');
select is((select status from public.vehicle_transfers where id=current_setting('test.garage_second')::uuid),'cancelled','cancellation is terminal');
select lives_ok($$select set_config('test.garage_second',public.create_vehicle_transfer('20000000-0000-4000-8000-000000000071','garage_recipient_71','{}')::text,true)$$,'sender can invite again after cancellation');
reset role;
select set_config('request.jwt.claim.sub','10000000-0000-4000-8000-000000000071',true);
set local role authenticated;
select throws_ok($$select public.decide_vehicle_transfer(current_setting('test.garage_second')::uuid,'cancel')$$,'42501','GARAGE_FORBIDDEN','recipient cannot cancel sender invitation');
select throws_ok($$select public.decide_vehicle_transfer(current_setting('test.garage_second')::uuid,null)$$,'42501','GARAGE_FORBIDDEN','null decision cannot bypass action authorization');
select lives_ok($$select public.decide_vehicle_transfer(current_setting('test.garage_second')::uuid,'reject')$$,'recipient can reject invitation');
select is((select status from public.vehicle_transfers where id=current_setting('test.garage_second')::uuid),'rejected','rejection is terminal');
select lives_ok($$update public.vehicles set archived_at=now() where id='20000000-0000-4000-8000-000000000070'$$,'recipient can archive received vehicle');
select throws_ok($$update public.vehicles set nickname='Changed' where id='20000000-0000-4000-8000-000000000070'$$,'55000','GARAGE_ARCHIVED','direct archived vehicle changes are blocked');
reset role;
set local role service_role;
select throws_ok($$update public.vehicle_documents set deleted_at=now() where id='40000000-0000-4000-8000-000000000070'$$,'55000','GARAGE_ARCHIVED','service API cannot remove current-owner documents from archived vehicle');
select lives_ok($$update public.vehicle_documents set deleted_at=now() where id='40000000-0000-4000-8000-000000000071'$$,'old owner can remove retained document even when new owner archives');
reset role;
select set_config('request.jwt.claim.sub','10000000-0000-4000-8000-000000000070',true);
set local role authenticated;
select lives_ok($$select set_config('test.garage_second',public.create_vehicle_transfer('20000000-0000-4000-8000-000000000071','garage_recipient_71','{}')::text,true)$$,'rejection unfreezes invitation creation');
select throws_ok($$update public.vehicle_transfers set status='accepted' where id=current_setting('test.garage_second')::uuid$$,'42501',null,'clients cannot forge transfer status');
reset role;
update public.vehicle_transfers set expires_at=now()-interval '1 second' where id=current_setting('test.garage_second')::uuid;
select set_config('request.jwt.claim.sub','10000000-0000-4000-8000-000000000071',true);
set local role authenticated;
select lives_ok($$select public.decide_vehicle_transfer(current_setting('test.garage_second')::uuid,'accept')$$,'expired invitation closes without accepting ownership');
select is((select status from public.vehicle_transfers where id=current_setting('test.garage_second')::uuid),'expired','expired state persists');
reset role;
select is((select owner_id::text from public.vehicles where id='20000000-0000-4000-8000-000000000071'),'10000000-0000-4000-8000-000000000070','expired acceptance does not move ownership');
select set_config('request.jwt.claim.sub','10000000-0000-4000-8000-000000000070',true);
set local role authenticated;
select lives_ok($$select set_config('test.garage_second',public.create_vehicle_transfer('20000000-0000-4000-8000-000000000071','garage_recipient_71','{}')::text,true)$$,'new invitation allowed after expiry');
reset role;
update public.account_access set status='suspended' where user_id='10000000-0000-4000-8000-000000000071';
select set_config('request.jwt.claim.sub','10000000-0000-4000-8000-000000000071',true);
set local role authenticated;
select throws_ok($$select public.decide_vehicle_transfer(current_setting('test.garage_second')::uuid,'accept')$$,'42501','GARAGE_FORBIDDEN','suspended recipient cannot accept ownership');
reset role;
select * from finish();
rollback;
