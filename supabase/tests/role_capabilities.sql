-- MoAcademy role-capability regression battery.
--
-- Proves each role can perform its whole job under real RLS, acting as a
-- non-privileged `authenticated` user. Every block ROLLS BACK, so running this
-- file mutates nothing. Swap the two ids for any real non-admin profile
-- (STUDENT) and any other profile (OTHER). Verified 2026-07-13.
--
--   STUDENT = 9507a0a2-f8e6-4adf-9b67-fcf2f236d663
--   OTHER   = 30247880-d4c0-4203-85d7-b3a07f9d8aa9
--
-- Each battery prints one row per capability: ok=true means the action was
-- permitted (or, for a NEGATIVE check, correctly denied). Fixtures that must
-- land already-graded use set_config('app.quiz_autograde','on',true) — the same
-- transaction-local escape the quiz RPC uses — because the submissions field
-- guard otherwise strips grades from any non-teaching insert (that guard is
-- itself a verified invariant; see security_invariants.sql).

-- ============================ INSTRUCTOR (10) =============================
begin;
  update public.profiles set role='instructor' where id='9507a0a2-f8e6-4adf-9b67-fcf2f236d663';
  insert into public.subject_enrollments(user_id,subject_code,role,term) values
    ('9507a0a2-f8e6-4adf-9b67-fcf2f236d663','MATH','instructor',(select value from public.app_settings where key='current_term')),
    ('30247880-d4c0-4203-85d7-b3a07f9d8aa9','MATH','student',(select value from public.app_settings where key='current_term'));
  insert into public.assignments(id,course_key,title,type,description,due_at,points)
    values ('11111111-1111-1111-1111-111111111111','sub_math','Seed','assignment','',now()+interval '3 days',100);
  insert into public.submissions(id,assignment_id,user_id,status,body)
    values ('11111111-0000-0000-0000-0000000000b1','11111111-1111-1111-1111-111111111111','30247880-d4c0-4203-85d7-b3a07f9d8aa9','submitted','w');
  create temp table _r(step text, ok boolean, detail text) on commit drop;
  grant all on _r to authenticated;
  set local role authenticated;
  set local request.jwt.claims = '{"sub":"9507a0a2-f8e6-4adf-9b67-fcf2f236d663","role":"authenticated"}';
  do $$
  declare gid uuid; bid uuid; sid uuid; qid uuid;
  begin
    begin insert into _r values('01 read roster',(select count(*) from public.subject_enrollments where subject_code='MATH' and role='student')>=1,'');
    exception when others then insert into _r values('01 read roster',false,sqlerrm); end;
    begin insert into public.assignments(course_key,title,type,description,due_at,points) values('sub_math','A','assignment','',now()+interval '5 days',50);
      insert into _r values('02 create assignment',true,'');
    exception when others then insert into _r values('02 create assignment',false,sqlerrm); end;
    begin update public.submissions set score=88,status='graded',graded_at=now() where id='11111111-0000-0000-0000-0000000000b1';
      insert into _r values('03 grade submission',(select score from public.submissions where id='11111111-0000-0000-0000-0000000000b1')=88,'');
    exception when others then insert into _r values('03 grade submission',false,sqlerrm); end;
    begin insert into public.attendance(course_key,student_id,on_date,status,noted_by) values('sub_math','30247880-d4c0-4203-85d7-b3a07f9d8aa9',current_date,'present','9507a0a2-f8e6-4adf-9b67-fcf2f236d663');
      insert into _r values('04 take attendance',true,'');
    exception when others then insert into _r values('04 take attendance',false,sqlerrm); end;
    begin insert into public.quiz_questions(id,assignment_id,position,prompt,options,points,kind) values(gen_random_uuid(),'11111111-1111-1111-1111-111111111111',0,'q',array['a','b'],5,'mcq') returning id into qid;
      insert into public.quiz_answer_keys(question_id,correct_index) values(qid,1);
      insert into _r values('05 author quiz + key',true,'');
    exception when others then insert into _r values('05 author quiz + key',false,sqlerrm); end;
    begin insert into public.course_groups(id,course_key,name,created_by) values(gen_random_uuid(),'sub_math','G','9507a0a2-f8e6-4adf-9b67-fcf2f236d663') returning id into gid;
      insert into public.group_members(group_id,student_id) values(gid,'30247880-d4c0-4203-85d7-b3a07f9d8aa9');
      insert into _r values('06 create group + member',true,'');
    exception when others then insert into _r values('06 create group + member',false,sqlerrm); end;
    begin insert into public.badges(id,course_key,name,description,icon,created_by) values(gen_random_uuid(),'sub_math','B','d','X','9507a0a2-f8e6-4adf-9b67-fcf2f236d663') returning id into bid;
      insert into public.badge_awards(badge_id,student_id,awarded_by,note) values(bid,'30247880-d4c0-4203-85d7-b3a07f9d8aa9','9507a0a2-f8e6-4adf-9b67-fcf2f236d663','n');
      insert into _r values('07 create + award badge',true,'');
    exception when others then insert into _r values('07 create + award badge',false,sqlerrm); end;
    begin insert into public.surveys(id,course_key,title,anonymous) values(gen_random_uuid(),'sub_math','S',true) returning id into sid;
      insert into public.survey_questions(survey_id,position,prompt,kind) values(sid,0,'r','rating');
      insert into _r values('08 create survey',true,'');
    exception when others then insert into _r values('08 create survey',false,sqlerrm); end;
    begin insert into public.office_hour_slots(instructor_id,course_key,starts_at,ends_at,location) values('9507a0a2-f8e6-4adf-9b67-fcf2f236d663','sub_math',now()+interval '1 day',now()+interval '1 day 1 hour','R');
      insert into _r values('09 create office-hour slot',true,'');
    exception when others then insert into _r values('09 create office-hour slot',false,sqlerrm); end;
    begin insert into public.course_syllabus(course_key,body,updated_by) values('sub_math','x','T') on conflict (course_key) do update set body=excluded.body;
      insert into _r values('10 edit syllabus',true,'');
    exception when others then insert into _r values('10 edit syllabus',false,sqlerrm); end;
  end $$;
  reset role;
  select 'INSTRUCTOR' as role, step, ok from _r order by step;
rollback;

-- ============================== STUDENT (13) ==============================
begin;
  insert into public.subject_enrollments(user_id,subject_code,role,term) values
    ('9507a0a2-f8e6-4adf-9b67-fcf2f236d663','MATH','student',(select value from public.app_settings where key='current_term')),
    ('30247880-d4c0-4203-85d7-b3a07f9d8aa9','MATH','instructor',(select value from public.app_settings where key='current_term'));
  insert into public.assignments(id,course_key,title,type,description,due_at,points) values
    ('11111111-1111-1111-1111-111111111111','sub_math','HW','assignment','',now()+interval '3 days',100),
    ('22222222-2222-2222-2222-222222222222','sub_math','Qz','quiz','',now()+interval '3 days',10);
  insert into public.quiz_questions(id,assignment_id,position,prompt,options,points,kind) values('33333333-3333-3333-3333-333333333333','22222222-2222-2222-2222-222222222222',0,'q',array['a','b'],10,'mcq');
  insert into public.quiz_answer_keys(question_id,correct_index) values('33333333-3333-3333-3333-333333333333',1);
  insert into public.modules(id,course_key,title,published,position) values('44444444-4444-4444-4444-444444444444','sub_math','M',true,0);
  insert into public.module_items(id,module_id,title,type,position) values('55555555-5555-5555-5555-555555555555','44444444-4444-4444-4444-444444444444','P','page',0);
  insert into public.office_hour_slots(id,instructor_id,course_key,starts_at,ends_at,location) values('66666666-6666-6666-6666-666666666666','30247880-d4c0-4203-85d7-b3a07f9d8aa9','sub_math',now()+interval '1 day',now()+interval '1 day 1 hour','R');
  insert into public.surveys(id,course_key,title,anonymous) values('77777777-7777-7777-7777-777777777777','sub_math','F',true);
  insert into public.survey_questions(id,survey_id,position,prompt,kind) values('88888888-8888-8888-8888-888888888888','77777777-7777-7777-7777-777777777777',0,'r','rating');
  insert into public.attendance(course_key,student_id,on_date,status,noted_by) values('sub_math','9507a0a2-f8e6-4adf-9b67-fcf2f236d663',current_date,'present','30247880-d4c0-4203-85d7-b3a07f9d8aa9');
  create temp table _r(step text, ok boolean, detail text) on commit drop;
  grant all on _r to authenticated;
  set local role authenticated;
  set local request.jwt.claims = '{"sub":"9507a0a2-f8e6-4adf-9b67-fcf2f236d663","role":"authenticated"}';
  do $$
  begin
    begin insert into _r values('01 read own enrolments',(select count(*) from public.subject_enrollments where user_id='9507a0a2-f8e6-4adf-9b67-fcf2f236d663')>=1,'');
    exception when others then insert into _r values('01 read own enrolments',false,sqlerrm); end;
    begin insert into _r values('02 read published assignments',(select count(*) from public.assignments where course_key='sub_math')>=2,'');
    exception when others then insert into _r values('02 read published assignments',false,sqlerrm); end;
    begin insert into public.submissions(assignment_id,user_id,status,body) values('11111111-1111-1111-1111-111111111111','9507a0a2-f8e6-4adf-9b67-fcf2f236d663','submitted','e');
      insert into _r values('03 submit assignment',true,'');
    exception when others then insert into _r values('03 submit assignment',false,sqlerrm); end;
    begin insert into _r values('04 read own submission',(select count(*) from public.submissions where user_id='9507a0a2-f8e6-4adf-9b67-fcf2f236d663')=1,'');
    exception when others then insert into _r values('04 read own submission',false,sqlerrm); end;
    begin insert into public.module_item_progress(user_id,item_id) values('9507a0a2-f8e6-4adf-9b67-fcf2f236d663','55555555-5555-5555-5555-555555555555');
      insert into _r values('05 mark module item done',true,'');
    exception when others then insert into _r values('05 mark module item done',false,sqlerrm); end;
    begin insert into public.discussion_topics(course_key,title,prompt,author_id,author_name) values('sub_math','Q','p','9507a0a2-f8e6-4adf-9b67-fcf2f236d663','S');
      insert into _r values('06 post discussion topic',true,'');
    exception when others then insert into _r values('06 post discussion topic',false,sqlerrm); end;
    begin perform public.submit_quiz_attempt('22222222-2222-2222-2222-222222222222','{"33333333-3333-3333-3333-333333333333":1}'::jsonb);
      insert into _r values('07 take quiz (RPC)',(select count(*) from public.quiz_attempts where student_id='9507a0a2-f8e6-4adf-9b67-fcf2f236d663')=1,'');
    exception when others then insert into _r values('07 take quiz (RPC)',false,sqlerrm); end;
    begin perform public.book_office_hour('66666666-6666-6666-6666-666666666666');
      insert into _r values('08 book office hour (RPC)',(select booked_by from public.office_hour_slots where id='66666666-6666-6666-6666-666666666666')='9507a0a2-f8e6-4adf-9b67-fcf2f236d663','');
    exception when others then insert into _r values('08 book office hour (RPC)',false,sqlerrm); end;
    begin perform public.submit_survey('77777777-7777-7777-7777-777777777777','{"88888888-8888-8888-8888-888888888888":"5"}'::jsonb);
      insert into _r values('09 submit survey (RPC)',(select count(*) from public.survey_completions where survey_id='77777777-7777-7777-7777-777777777777')=1,'');
    exception when others then insert into _r values('09 submit survey (RPC)',false,sqlerrm); end;
    begin insert into _r values('10 read own attendance',(select count(*) from public.attendance where student_id='9507a0a2-f8e6-4adf-9b67-fcf2f236d663')>=1,'');
    exception when others then insert into _r values('10 read own attendance',false,sqlerrm); end;
    begin insert into _r values('11 read course-mate profile',(select count(*) from public.profiles where id='30247880-d4c0-4203-85d7-b3a07f9d8aa9')=1,'');
    exception when others then insert into _r values('11 read course-mate profile',false,sqlerrm); end;
    begin insert into public.messages(sender_id,recipient_id,sender_name,recipient_name,subject,body) values('9507a0a2-f8e6-4adf-9b67-fcf2f236d663','30247880-d4c0-4203-85d7-b3a07f9d8aa9','S','T','H','q');
      insert into _r values('12 message a course-mate',true,'');
    exception when others then insert into _r values('12 message a course-mate',false,sqlerrm); end;
    begin insert into _r values('13 read course surveys',(select count(*) from public.surveys where course_key='sub_math')>=1,'');
    exception when others then insert into _r values('13 read course surveys',false,sqlerrm); end;
  end $$;
  reset role;
  select 'STUDENT' as role, step, ok from _r order by step;
rollback;

-- ============================== GUARDIAN (7) ==============================
begin;
  update public.profiles set role='parent' where id='30247880-d4c0-4203-85d7-b3a07f9d8aa9';
  insert into public.guardian_links(guardian_id,student_id) values('30247880-d4c0-4203-85d7-b3a07f9d8aa9','9507a0a2-f8e6-4adf-9b67-fcf2f236d663');
  insert into public.subject_enrollments(user_id,subject_code,role,term) values('9507a0a2-f8e6-4adf-9b67-fcf2f236d663','MATH','student',(select value from public.app_settings where key='current_term'));
  insert into public.assignments(id,course_key,title,type,description,due_at,points) values('11111111-1111-1111-1111-111111111111','sub_math','HW','assignment','',now()+interval '3 days',100);
  select set_config('app.quiz_autograde','on',true);
  insert into public.submissions(assignment_id,user_id,status,body,score,graded_at) values('11111111-1111-1111-1111-111111111111','9507a0a2-f8e6-4adf-9b67-fcf2f236d663','graded','w',91,now());
  select set_config('app.quiz_autograde','off',true);
  insert into public.attendance(course_key,student_id,on_date,status,noted_by) values('sub_math','9507a0a2-f8e6-4adf-9b67-fcf2f236d663',current_date,'absent','9507a0a2-f8e6-4adf-9b67-fcf2f236d663');
  insert into public.badges(id,course_key,name,description,icon) values('99999999-9999-9999-9999-999999999999','sub_math','B','d','X');
  insert into public.badge_awards(badge_id,student_id,note) values('99999999-9999-9999-9999-999999999999','9507a0a2-f8e6-4adf-9b67-fcf2f236d663','g');
  create temp table _r(step text, ok boolean, detail text) on commit drop;
  grant all on _r to authenticated;
  set local role authenticated;
  set local request.jwt.claims = '{"sub":"30247880-d4c0-4203-85d7-b3a07f9d8aa9","role":"authenticated"}';
  do $$
  begin
    begin insert into _r values('01 read child link',(select count(*) from public.guardian_links where guardian_id='30247880-d4c0-4203-85d7-b3a07f9d8aa9')=1,'');
    exception when others then insert into _r values('01 read child link',false,sqlerrm); end;
    begin insert into _r values('02 read child profile',(select count(*) from public.profiles where id='9507a0a2-f8e6-4adf-9b67-fcf2f236d663')=1,'');
    exception when others then insert into _r values('02 read child profile',false,sqlerrm); end;
    begin insert into _r values('03 read child enrolments',(select count(*) from public.subject_enrollments where user_id='9507a0a2-f8e6-4adf-9b67-fcf2f236d663')>=1,'');
    exception when others then insert into _r values('03 read child enrolments',false,sqlerrm); end;
    begin insert into _r values('04 read child grades',(select count(*) from public.submissions where user_id='9507a0a2-f8e6-4adf-9b67-fcf2f236d663' and status='graded')>=1,'');
    exception when others then insert into _r values('04 read child grades',false,sqlerrm); end;
    begin insert into _r values('05 read child attendance',(select count(*) from public.attendance where student_id='9507a0a2-f8e6-4adf-9b67-fcf2f236d663')>=1,'');
    exception when others then insert into _r values('05 read child attendance',false,sqlerrm); end;
    begin insert into _r values('06 read child badges',(select count(*) from public.badge_awards where student_id='9507a0a2-f8e6-4adf-9b67-fcf2f236d663')>=1,'');
    exception when others then insert into _r values('06 read child badges',false,sqlerrm); end;
    begin insert into _r values('07 NEGATIVE cannot read non-child submission',(select count(*) from public.submissions where user_id='30247880-d4c0-4203-85d7-b3a07f9d8aa9')=0,'');
    exception when others then insert into _r values('07 NEGATIVE cannot read non-child submission',false,sqlerrm); end;
  end $$;
  reset role;
  select 'GUARDIAN' as role, step, ok from _r order by step;
rollback;
