// Seeds one institution, 3 departments, 5 subjects, and ~15 synthetic teachers so the
// app is demo-able immediately after the schema is applied. Uses the service-role
// client because there is no authenticated user in a seed context (RLS would block an
// anon insert here, correctly).
require('dotenv').config({ quiet: true });
const { supabaseAdmin } = require('./db');

const INSTITUTION_NAME = 'ZivaDzidzo Pilot Secondary School';

const DEPARTMENTS = ['Sciences', 'Languages & Humanities', 'Technology & Computing'];

const SUBJECTS = [
  { name: 'Mathematics', department: 'Sciences', grade_level: 'Form 3' },
  { name: 'Physics', department: 'Sciences', grade_level: 'Form 4' },
  { name: 'English Language', department: 'Languages & Humanities', grade_level: 'Form 2' },
  { name: 'History', department: 'Languages & Humanities', grade_level: 'Form 3' },
  { name: 'Computer Science', department: 'Technology & Computing', grade_level: 'Form 4' },
];

const FIRST_NAMES = ['Tendai', 'Rutendo', 'Farai', 'Chipo', 'Tapiwa', 'Nyasha', 'Kudakwashe', 'Rumbidzai', 'Tinashe', 'Vimbai', 'Simbarashe', 'Panashe', 'Anesu', 'Tafadzwa', 'Chiedza'];
const LAST_NAMES = ['Moyo', 'Ncube', 'Dube', 'Mutasa', 'Chirwa', 'Sibanda', 'Gumbo', 'Chikafu', 'Muzenda', 'Zvobgo'];
const USAGE_FREQUENCIES = ['never', 'rarely', 'sometimes', 'often', 'daily'];

function randomFrom(list) {
  return list[Math.floor(Math.random() * list.length)];
}

function randomInt(min, max) {
  return Math.floor(Math.random() * (max - min + 1)) + min;
}

async function seed() {
  const { data: existing, error: existingError } = await supabaseAdmin
    .from('institutions')
    .select('id')
    .eq('name', INSTITUTION_NAME)
    .maybeSingle();

  if (existingError) {
    throw new Error(`Could not check for existing institution: ${existingError.message}`);
  }
  if (existing) {
    console.log(`Institution "${INSTITUTION_NAME}" already seeded (id=${existing.id}). Skipping.`);
    return;
  }

  const { data: institution, error: institutionError } = await supabaseAdmin
    .from('institutions')
    .insert([{ name: INSTITUTION_NAME, district: 'Mutare', school_type: 'secondary' }])
    .select()
    .single();
  if (institutionError) throw new Error(`Institution insert failed: ${institutionError.message}`);
  console.log(`Created institution ${institution.id}`);

  const departmentByName = {};
  for (const name of DEPARTMENTS) {
    const { data, error } = await supabaseAdmin
      .from('departments')
      .insert([{ institution_id: institution.id, name }])
      .select()
      .single();
    if (error) throw new Error(`Department "${name}" insert failed: ${error.message}`);
    departmentByName[name] = data;
  }
  console.log(`Created ${Object.keys(departmentByName).length} departments`);

  const subjects = [];
  for (const subject of SUBJECTS) {
    const department = departmentByName[subject.department];
    const { data, error } = await supabaseAdmin
      .from('subjects')
      .insert([{ department_id: department.id, name: subject.name, grade_level: subject.grade_level }])
      .select()
      .single();
    if (error) throw new Error(`Subject "${subject.name}" insert failed: ${error.message}`);
    subjects.push(data);
  }
  console.log(`Created ${subjects.length} subjects`);

  const teacherRows = [];
  const usedNames = new Set();
  for (let i = 0; i < 15; i += 1) {
    let fullName;
    do {
      fullName = `${randomFrom(FIRST_NAMES)} ${randomFrom(LAST_NAMES)}`;
    } while (usedNames.has(fullName));
    usedNames.add(fullName);

    const subject = subjects[i % subjects.length];
    const yearsExperience = randomInt(1, 28);
    teacherRows.push({
      institution_id: institution.id,
      full_name: fullName,
      subject_id: subject.id,
      years_experience: yearsExperience,
      ai_tool_usage_frequency: randomFrom(USAGE_FREQUENCIES),
      digital_skills_score: randomInt(20, 95),
      training_hours: randomInt(0, 60),
      last_assessed_at: new Date(Date.now() - randomInt(0, 180) * 24 * 60 * 60 * 1000).toISOString(),
    });
  }

  const { error: teachersError } = await supabaseAdmin.from('teachers').insert(teacherRows);
  if (teachersError) throw new Error(`Teacher insert failed: ${teachersError.message}`);
  console.log(`Created ${teacherRows.length} teachers`);

  console.log('Seed complete.');
}

seed()
  .then(() => process.exit(0))
  .catch((error) => {
    console.error('Seed failed:', error.message);
    process.exit(1);
  });
