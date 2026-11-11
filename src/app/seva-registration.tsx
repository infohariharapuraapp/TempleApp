import AutoTranslatedText from '@/components/AutoTranslatedText';
import { router } from 'expo-router';
import { useMemo, useState } from 'react';
import {
  Alert,
  Modal,
  ScrollView,
  StyleSheet,
  Text,
  TextInput,
  TouchableOpacity,
  View,
} from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';

const C = {
  purple: '#6A35A0', dark: '#54257F', light: '#F3E2F8', bg: '#FFF4F8',
  white: '#FFF', text: '#102B3A', muted: '#71808B', line: '#7C858B',
  red: '#E84A55', green: '#2F7D4A', paleGreen: '#E5F3E9',
};

const SEVA_TYPES = [
  { id: 'individual', title: 'Individual Seva', description: 'Kindly continue for Individual Seva registration', icon: '👤' },
  { id: 'group', title: 'Group Seva', description: 'Kindly continue for Group Seva registration', icon: '👥' },
];


const STATES = ['Andhra Pradesh', 'Telangana', 'Karnataka', 'Tamil Nadu'];
const DISTRICTS = ['Guntur', 'Krishna', 'Prakasam', 'NTR'];
const BLOOD = ['A+', 'A-', 'B+', 'B-', 'AB+', 'AB-', 'O+', 'O-'];
const QUALIFICATIONS = ['10th', 'Intermediate', 'Graduate', 'Post Graduate', 'Other'];
const TIMES = ['06:00 AM', '07:00 AM', '08:00 AM', '10:00 AM', '04:00 PM', '06:00 PM', '07:00 PM'];
const DATES = [
  { id: '2026-09-10', day: 'THU', date: '10', month: 'SEP' },
  { id: '2026-09-11', day: 'FRI', date: '11', month: 'SEP' },
  { id: '2026-09-12', day: 'SAT', date: '12', month: 'SEP' },
  { id: '2026-09-13', day: 'SUN', date: '13', month: 'SEP' },
];

type Type = 'individual' | 'group';
type Picker = { visible: boolean; title: string; options: string[]; onSelect: (v: string) => void };
type Member = {
  id: number; name: string; mobile: string; aadhaar: string; aadhaarFile: string;
  dob: string; age: string; gender: string; country: string; pincode: string;
  state: string; district: string; mandal: string; city: string; street: string; door: string;
};

const blankMember = (id: number): Member => ({
  id, name: '', mobile: '', aadhaar: '', aadhaarFile: '', dob: '', age: '', gender: '',
  country: 'India', pincode: '', state: '', district: '', mandal: '', city: '', street: '', door: '',
});

export default function SevaRegistrationScreen() {
  const [type, setType] = useState<Type | null>(null);
  const [step, setStep] = useState(0);

  // Individual personal details
  const [name, setName] = useState(''); const [mobile, setMobile] = useState('');
  const [aadhaar, setAadhaar] = useState(''); const [aadhaarFile, setAadhaarFile] = useState('');
  const [dob, setDob] = useState(''); const [age, setAge] = useState(''); const [email, setEmail] = useState('');
  const [blood, setBlood] = useState(''); const [gender, setGender] = useState('');
  const [mentallyFit, setMentallyFit] = useState(false); const [physicallyFit, setPhysicallyFit] = useState(false);
  const [qualification, setQualification] = useState(''); const [profession, setProfession] = useState(''); const [interest, setInterest] = useState('');

  // Individual address
  const [pincode, setPincode] = useState(''); const [state, setState] = useState(''); const [district, setDistrict] = useState('');
  const [mandal, setMandal] = useState(''); const [city, setCity] = useState(''); const [street, setStreet] = useState(''); const [door, setDoor] = useState('');

  // Group
  const [teamSize, setTeamSize] = useState('10');
  const [members, setMembers] = useState<Member[]>([]);
  const [editingMember, setEditingMember] = useState<Member | null>(null);
  const [leaderId, setLeaderId] = useState<number | null>(null);
  const [groupName, setGroupName] = useState('');

  // Seva selection is intentionally last.
  const [selectedDate, setSelectedDate] = useState(DATES[0].id);
  const [selectedTime, setSelectedTime] = useState(TIMES[2]);
  const [registered, setRegistered] = useState(false); const [registrationId, setRegistrationId] = useState('');

  const [picker, setPicker] = useState<Picker>({ visible: false, title: '', options: [], onSelect: () => {} });
  const date = useMemo(() => DATES.find(x => x.id === selectedDate) ?? DATES[0], [selectedDate]);

  const openPicker = (title: string, options: string[], onSelect: (v: string) => void) => setPicker({ visible: true, title, options, onSelect });
  const closePicker = () => setPicker(p => ({ ...p, visible: false }));

  const chooseType = (v: Type) => { setType(v); setStep(1); };

  const formatDob = (value: string, setter: (v: string) => void) => {
    const d = value.replace(/\D/g, '').slice(0, 8);
    let out = d; if (d.length > 2) out = `${d.slice(0, 2)}/${d.slice(2)}`; if (d.length > 4) out = `${d.slice(0, 2)}/${d.slice(2, 4)}/${d.slice(4)}`;
    setter(out);
  };

  const validateIndividual = () => {
    if (step === 1 && (!name || mobile.replace(/\D/g, '').length !== 10 || aadhaar.replace(/\D/g, '').length !== 12 || !aadhaarFile || !dob || !age || !gender || !mentallyFit || !physicallyFit)) {
      Alert.alert('Required Details', 'Please complete personal details, 12-digit Aadhaar number, Aadhaar file, DOB, gender and fitness declarations.'); return false;
    }
    if (step === 2 && (!pincode || !state || !district || !city || !street || !door)) { Alert.alert('Required Details', 'Please complete all required address details.'); return false; }
    if (step === 3 && (!qualification || !profession || !interest)) { Alert.alert('Required Details', 'Please complete profession and education details.'); return false; }
    if (step === 4 && !selectedDate) { Alert.alert('Date Required', 'Please select a seva date.'); return false; }
    return true;
  };

  const validateGroup = () => {
    const size = Number(teamSize);
    if (step === 1 && (!Number.isInteger(size) || size < 10)) { Alert.alert('Minimum Team Size', 'Group Seva registration starts with a minimum of 10 members.'); return false; }
    if (step === 2 && members.length < size) { Alert.alert('Add Members', `Please add all ${size} member profiles before continuing.`); return false; }
    if (step === 3 && leaderId === null) { Alert.alert('Team Leader', 'Please select one team leader from the added member profiles.'); return false; }
    if (step === 4 && !selectedDate) { Alert.alert('Date Required', 'Please select a seva date.'); return false; }
    return true;
  };

  const next = () => {
    const valid = type === 'individual' ? validateIndividual() : validateGroup(); if (!valid) return;
    const max = 4;
    if (step < max) { setStep(step + 1); return; }
    const id = `SR-${Math.floor(1000 + Math.random() * 9000)}`; setRegistrationId(id); setRegistered(true);
  };

  const back = () => {
    if (step === 1) { setType(null); setStep(0); return; }
    if (step === 0) { router.back(); return; }
    setStep(step - 1);
  };

  const attachIndividualAadhaar = () => setAadhaarFile('aadhaar-card.pdf • attached (mock)');

  const addMember = () => {
    const nextId = members.length + 1;
    setEditingMember(blankMember(nextId));
  };
  const saveMember = () => {
    if (!editingMember) return;
    const m = editingMember;
    if (!m.name || m.mobile.replace(/\D/g, '').length !== 10 || m.aadhaar.replace(/\D/g, '').length !== 12 || !m.aadhaarFile || !m.dob || !m.age || !m.gender || !m.pincode || !m.state || !m.district || !m.city || !m.street || !m.door) {
      Alert.alert('Member Details', 'Complete the member personal details, Aadhaar number/file and address before saving.'); return;
    }
    setMembers(old => { const exists = old.some(x => x.id === m.id); return exists ? old.map(x => x.id === m.id ? m : x) : [...old, m]; });
    setEditingMember(null);
  };

  if (registered && type) return <Confirmation type={type} id={registrationId} name={type === 'individual' ? name : (members.find(m => m.id === leaderId)?.name || 'Group')} groupSize={members.length} groupName={groupName} date={date} time={selectedTime} />;

  if (!type) return (
    <SafeAreaView style={styles.screen}>
      <TopBar title="Seva Registration" onBack={() => router.back()} />
      <ScrollView contentContainerStyle={styles.typeContent}>
        <AutoTranslatedText style={styles.pageTitle}>Seva Registration</AutoTranslatedText>
        <AutoTranslatedText style={styles.pageSubtitle}>Select Individual or Group Seva registration to continue.</AutoTranslatedText>
        {SEVA_TYPES.map(item => <TouchableOpacity key={item.id} style={styles.typeCard} activeOpacity={0.88} onPress={() => chooseType(item.id as Type)}>
          <View style={styles.typeIcon}><Text style={styles.typeIconText}>{item.icon}</Text></View>
          <View style={styles.typeText}><Text style={styles.typeTitle}>{item.title}</Text><Text style={styles.typeDescription}>{item.description}</Text><AutoTranslatedText style={styles.registerLink}>Click here for Registration</AutoTranslatedText></View><Text style={styles.typeArrow}>›</Text>
        </TouchableOpacity>)}
      </ScrollView>
    </SafeAreaView>
  );

  const group = type === 'group';
  const stepTitle = group
    ? ['','Team Size','Member Profiles','Select Team Leader','Preferred Date & Time'][step]
    : ['','Personal Details','Address Details','Profession & Education Details','Preferred Date & Time'][step];

  return (
    <SafeAreaView style={styles.screen}>
      <TopBar title={group ? 'Group Seva' : 'Individual Seva'} onBack={back} />
      <ScrollView contentContainerStyle={styles.formPage} showsVerticalScrollIndicator={false}>
        <View style={styles.stepHeader}><Text style={styles.stepTitle}>{stepTitle}</Text><Text style={styles.stepCount}>STEP {step} OF 4</Text></View>

        {!group && step === 1 && <IndividualPersonal {...{name,setName,mobile,setMobile,aadhaar,setAadhaar,dob,setDob,age,setAge,email,setEmail,blood,setBlood,gender,setGender,mentallyFit,setMentallyFit,physicallyFit,setPhysicallyFit,openPicker,attachIndividualAadhaar,aadhaarFile,formatDob}} />}
        {!group && step === 2 && <AddressForm {...{pincode,setPincode,state,setState,district,setDistrict,mandal,setMandal,city,setCity,street,setStreet,door,setDoor,openPicker}} />}
        {!group && step === 3 && <ProfessionForm {...{qualification,setQualification,profession,setProfession,interest,setInterest,openPicker}} />}

        {group && step === 1 && <GroupSize {...{teamSize,setTeamSize,groupName,setGroupName}} />}
        {group && step === 2 && <MemberProfiles members={members} teamSize={Number(teamSize)} onAdd={addMember} onEdit={setEditingMember} leaderId={leaderId} />}
        {group && step === 3 && <LeaderPicker members={members} leaderId={leaderId} setLeaderId={setLeaderId} />}

        {step === 4 && <DateTime {...{selectedDate,setSelectedDate,selectedTime,setSelectedTime}} />}

        <View style={styles.bottomButtons}>
          <TouchableOpacity style={styles.bottomBack} onPress={back}><AutoTranslatedText style={styles.bottomBackText}>Back</AutoTranslatedText></TouchableOpacity>
          <TouchableOpacity style={styles.continueButton} onPress={next}><Text style={styles.continueText}>{step === 4 ? 'Submit Registration' : 'Continue'}</Text></TouchableOpacity>
        </View>
      </ScrollView>

      <Modal transparent visible={picker.visible} animationType="slide" onRequestClose={closePicker}>
        <View style={styles.modalOverlay}><View style={styles.modalCard}><View style={styles.modalHeader}><Text style={styles.modalTitle}>{picker.title}</Text><TouchableOpacity onPress={closePicker}><Text style={styles.modalClose}>×</Text></TouchableOpacity></View>{picker.options.map(o => <TouchableOpacity key={o} style={styles.modalOption} onPress={() => { picker.onSelect(o); closePicker(); }}><Text style={styles.modalOptionText}>{o}</Text></TouchableOpacity>)}</View></View>
      </Modal>

      {editingMember && <MemberModal member={editingMember} setMember={setEditingMember} onSave={saveMember} onCancel={() => setEditingMember(null)} />}
    </SafeAreaView>
  );
}

function TopBar({ title, onBack }: { title: string; onBack: () => void }) { return <View style={styles.topBar}><TouchableOpacity onPress={onBack} style={styles.backTop}><Text style={styles.backArrow}>‹</Text></TouchableOpacity><Text style={styles.topTitle}>{title}</Text></View>; }

function IndividualPersonal(p: any) { return <View style={styles.formCard}>
  <Field label="Full Name" required value={p.name} placeholder="Enter full name" onChangeText={p.setName} />
  <Field label="Mobile Number" required value={p.mobile} placeholder="Enter 10-digit mobile number" onChangeText={p.setMobile} keyboardType="phone-pad" maxLength={10} />
  <Field label="Aadhaar Card Number" required value={p.aadhaar} placeholder="Enter 12-digit Aadhaar number" onChangeText={p.setAadhaar} keyboardType="number-pad" maxLength={12} />
  <UploadField file={p.aadhaarFile} onPress={p.attachIndividualAadhaar} />
  <Field label="Date of Birth" required value={p.dob} placeholder="DD/MM/YYYY" onChangeText={(v: string) => p.formatDob(v, p.setDob)} keyboardType="number-pad" maxLength={10} />
  <Field label="Age" required value={p.age} placeholder="Enter age" onChangeText={p.setAge} keyboardType="number-pad" maxLength={3} />
  <Field label="Email Id" value={p.email} placeholder="Enter email" onChangeText={p.setEmail} keyboardType="email-address" />
  <Field label="Blood Group" value={p.blood} dropdown onPress={() => p.openPicker('Blood Group', BLOOD, p.setBlood)} />
  <Text style={styles.label}>Gender<Text style={styles.required}> *</Text></Text><View style={styles.optionRow}><Radio label="Male" selected={p.gender === 'Male'} onPress={() => p.setGender('Male')} /><Radio label="Female" selected={p.gender === 'Female'} onPress={() => p.setGender('Female')} /></View>
  <Text style={styles.label}>Fitness<Text style={styles.required}> *</Text></Text><View style={styles.optionRow}><Checkbox label="Mentally Fit" selected={p.mentallyFit} onPress={() => p.setMentallyFit(!p.mentallyFit)} /><Checkbox label="Physically Fit" selected={p.physicallyFit} onPress={() => p.setPhysicallyFit(!p.physicallyFit)} /></View>
</View>; }

function AddressForm(p: any) { return <View style={styles.formCard}>
  <Field label="Country" required value="India" dropdown onPress={() => {}} />
  <Field label="Pincode" required value={p.pincode} placeholder="Enter pincode" onChangeText={p.setPincode} keyboardType="number-pad" maxLength={6} />
  <Field label="State" required value={p.state} dropdown onPress={() => p.openPicker('State', STATES, p.setState)} />
  <Field label="District" required value={p.district} dropdown onPress={() => p.openPicker('District', DISTRICTS, p.setDistrict)} />
  <Field label="Mandal (Optional)" value={p.mandal} placeholder="Enter mandal" onChangeText={p.setMandal} />
  <Field label="City" required value={p.city} placeholder="Enter city" onChangeText={p.setCity} />
  <Field label="Street" required value={p.street} placeholder="Enter street" onChangeText={p.setStreet} />
  <Field label="Door Number" required value={p.door} placeholder="Enter door number" onChangeText={p.setDoor} />
</View>; }

function ProfessionForm(p: any) { return <View style={styles.formCard}><Field label="Qualification" required value={p.qualification} dropdown onPress={() => p.openPicker('Qualification', QUALIFICATIONS, p.setQualification)} /><Field label="Profession" required value={p.profession} placeholder="Enter profession" onChangeText={p.setProfession} /><Field label="Area Of Interest" required value={p.interest} placeholder="Enter area of interest" onChangeText={p.setInterest} /></View>; }

function GroupSize(p: any) { return <View style={styles.formCard}><AutoTranslatedText style={styles.groupInfoTitle}>Group Seva Registration</AutoTranslatedText><AutoTranslatedText style={styles.groupInfo}>Group registration starts with a minimum team size of 10 members. Enter the required team size first. Member profiles will be collected next.</AutoTranslatedText><Field label="Team Size" required value={p.teamSize} placeholder="Minimum 10" onChangeText={(v: string) => p.setTeamSize(v.replace(/\D/g, '').slice(0,3))} keyboardType="number-pad" maxLength={3} /><Field label="Group Name" value={p.groupName} placeholder="Enter group name" onChangeText={p.setGroupName} /><View style={styles.minimumBadge}><AutoTranslatedText style={styles.minimumBadgeText}>MINIMUM 10 MEMBERS</AutoTranslatedText></View></View>; }

function MemberProfiles({ members, teamSize, onAdd, onEdit, leaderId }: { members: Member[]; teamSize: number; onAdd: () => void; onEdit: (m: Member) => void; leaderId: number | null }) { return <View>
  <View style={styles.memberProgress}><AutoTranslatedText style={styles.memberProgressTitle}>Member Profiles</AutoTranslatedText><Text style={styles.memberProgressCount}>{members.length} / {teamSize} added</Text></View>
  <AutoTranslatedText style={styles.groupInfo}>Add each member's personal details, Aadhaar number/file and address. Seva services will open only after all selected members are added.</AutoTranslatedText>
  {members.map((m, i) => <TouchableOpacity key={m.id} style={styles.memberCard} onPress={() => onEdit(m)}><View style={styles.memberNumber}><Text style={styles.memberNumberText}>{i + 1}</Text></View><View style={{flex:1}}><Text style={styles.memberName}>{m.name}</Text><Text style={styles.memberMeta}>{m.mobile} • Aadhaar ending {m.aadhaar.slice(-4)}</Text></View>{leaderId === m.id && <AutoTranslatedText style={styles.leaderTag}>TEAM LEADER</AutoTranslatedText>}<Text style={styles.editArrow}>›</Text></TouchableOpacity>)}
  {members.length < teamSize && <TouchableOpacity style={styles.addMemberButton} onPress={onAdd}><Text style={styles.addMemberPlus}>＋</Text><Text style={styles.addMemberText}>Add Member {members.length + 1}</Text></TouchableOpacity>}
</View>; }

function LeaderPicker({ members, leaderId, setLeaderId }: { members: Member[]; leaderId: number | null; setLeaderId: (id: number) => void }) { return <View><AutoTranslatedText style={styles.groupInfo}>Select one member as the Team Leader. The selected leader will be shown on the final Group Seva registration.</AutoTranslatedText>{members.map(m => <TouchableOpacity key={m.id} style={[styles.leaderCard, leaderId === m.id && styles.leaderCardSelected]} onPress={() => setLeaderId(m.id)}><View style={[styles.radio, leaderId === m.id && styles.radioSelected]}>{leaderId === m.id && <View style={styles.radioDot}/>}</View><View style={{flex:1}}><Text style={styles.memberName}>{m.name}</Text><Text style={styles.memberMeta}>{m.mobile}</Text></View>{leaderId === m.id && <AutoTranslatedText style={styles.leaderTag}>TEAM LEADER</AutoTranslatedText>}</TouchableOpacity>)}</View>; }

function DateTime(p: any) { return <View><Text style={styles.label}>Select Date<Text style={styles.required}> *</Text></Text><ScrollView horizontal showsHorizontalScrollIndicator={false} style={{marginBottom:25}}>{DATES.map(x => <TouchableOpacity key={x.id} onPress={() => p.setSelectedDate(x.id)} style={[styles.dateCard,p.selectedDate===x.id&&styles.dateCardSelected]}><Text style={[styles.dateDay,p.selectedDate===x.id&&styles.whiteText]}>{x.day}</Text><Text style={[styles.dateNumber,p.selectedDate===x.id&&styles.whiteText]}>{x.date}</Text><Text style={[styles.dateMonth,p.selectedDate===x.id&&styles.whiteText]}>{x.month}</Text></TouchableOpacity>)}</ScrollView><Text style={styles.label}>Select Time<Text style={styles.required}> *</Text></Text><View style={styles.timeGrid}>{TIMES.map(t => <TouchableOpacity key={t} onPress={() => p.setSelectedTime(t)} style={[styles.timeChip,p.selectedTime===t&&styles.timeChipSelected]}><Text style={[styles.timeText,p.selectedTime===t&&styles.whiteText]}>{t}</Text></TouchableOpacity>)}</View><View style={styles.lockCard}><Text style={styles.lockIcon}>🛕</Text><View style={{flex:1}}><AutoTranslatedText style={styles.lockTitle}>Seva will be assigned by Admin</AutoTranslatedText><AutoTranslatedText style={styles.lockText}>Submit your preferred date and time. Temple admin will review the registration and assign the suitable seva later.</AutoTranslatedText></View></View></View>; }

function UploadField({ file, onPress }: { file: string; onPress: () => void }) { return <View style={styles.uploadBox}><View style={{flex:1}}><Text style={styles.uploadTitle}>Aadhaar Card File<Text style={styles.required}> *</Text></Text><Text style={styles.uploadHint}>{file || 'Upload PDF or JPG of Aadhaar card'}</Text></View><TouchableOpacity style={styles.uploadButton} onPress={onPress}><Text style={styles.uploadButtonText}>{file ? 'Attached' : 'Upload'}</Text></TouchableOpacity></View>; }

function MemberModal({ member, setMember, onSave, onCancel }: { member: Member; setMember: (m: Member|null)=>void; onSave:()=>void; onCancel:()=>void }) { const update=(key:keyof Member,v:string)=>setMember({...member,[key]:v}); const dob=(v:string)=>{const d=v.replace(/\D/g,'').slice(0,8);let o=d;if(d.length>2)o=`${d.slice(0,2)}/${d.slice(2)}`;if(d.length>4)o=`${d.slice(0,2)}/${d.slice(2,4)}/${d.slice(4)}`;update('dob',o)}; return <Modal visible transparent animationType="slide"><View style={styles.modalOverlay}><View style={styles.memberModal}><Text style={styles.modalTitle}>Member {member.id} Profile</Text><ScrollView showsVerticalScrollIndicator={false}><Field label="Full Name" required value={member.name} placeholder="Enter full name" onChangeText={(v: string)=>update('name',v)} /><Field label="Mobile Number" required value={member.mobile} placeholder="10-digit mobile" onChangeText={(v: string)=>update('mobile',v)} keyboardType="phone-pad" maxLength={10}/><Field label="Aadhaar Card Number" required value={member.aadhaar} placeholder="12-digit Aadhaar" onChangeText={(v: string)=>update('aadhaar',v)} keyboardType="number-pad" maxLength={12}/><UploadField file={member.aadhaarFile} onPress={()=>update('aadhaarFile','aadhaar-member-'+member.id+'.pdf • attached (mock)')} /><Field label="Date of Birth" required value={member.dob} placeholder="DD/MM/YYYY" onChangeText={dob} keyboardType="number-pad" maxLength={10}/><Field label="Age" required value={member.age} placeholder="Age" onChangeText={(v: string)=>update('age',v)} keyboardType="number-pad" maxLength={3}/><Text style={styles.label}>Gender<Text style={styles.required}> *</Text></Text><View style={styles.optionRow}><Radio label="Male" selected={member.gender==='Male'} onPress={()=>update('gender','Male')}/><Radio label="Female" selected={member.gender==='Female'} onPress={()=>update('gender','Female')}/></View><AutoTranslatedText style={styles.modalSection}>Address Details</AutoTranslatedText><Field label="Pincode" required value={member.pincode} placeholder="Pincode" onChangeText={(v: string)=>update('pincode',v)} keyboardType="number-pad" maxLength={6}/><Field label="State" required value={member.state} placeholder="State" onChangeText={(v: string)=>update('state',v)}/><Field label="District" required value={member.district} placeholder="District" onChangeText={(v: string)=>update('district',v)}/><Field label="Mandal" value={member.mandal} placeholder="Mandal" onChangeText={(v: string)=>update('mandal',v)}/><Field label="City" required value={member.city} placeholder="City" onChangeText={(v: string)=>update('city',v)}/><Field label="Street" required value={member.street} placeholder="Street" onChangeText={(v: string)=>update('street',v)}/><Field label="Door Number" required value={member.door} placeholder="Door number" onChangeText={(v: string)=>update('door',v)}/></ScrollView><View style={styles.modalButtons}><TouchableOpacity style={styles.bottomBack} onPress={onCancel}><AutoTranslatedText style={styles.bottomBackText}>Cancel</AutoTranslatedText></TouchableOpacity><TouchableOpacity style={styles.continueButton} onPress={onSave}><AutoTranslatedText style={styles.continueText}>Save Member</AutoTranslatedText></TouchableOpacity></View></View></View></Modal>; }

function Field({ label, required, value, placeholder, onChangeText, keyboardType, maxLength, dropdown, onPress, multiline }: any) { return <View style={styles.field}><Text style={styles.label}>{label}{required&&<Text style={styles.required}> *</Text>}</Text>{dropdown?<TouchableOpacity style={styles.fieldLine} onPress={onPress}><Text style={[styles.fieldValue,!value&&styles.placeholder]}>{value||placeholder||''}</Text><Text style={styles.fieldIcon}>⌄</Text></TouchableOpacity>:<TextInput style={[styles.inputLine,multiline&&styles.multiline]} value={value} placeholder={placeholder} placeholderTextColor={C.muted} onChangeText={onChangeText} keyboardType={keyboardType} maxLength={maxLength} multiline={multiline}/>}</View>; }
function Radio({label,selected,onPress}:{label:string;selected:boolean;onPress:()=>void}){return <TouchableOpacity style={styles.choice} onPress={onPress}><View style={[styles.radio,selected&&styles.radioSelected]}>{selected&&<View style={styles.radioDot}/>}</View><Text style={styles.choiceText}>{label}</Text></TouchableOpacity>}
function Checkbox({label,selected,onPress}:{label:string;selected:boolean;onPress:()=>void}){return <TouchableOpacity style={styles.choice} onPress={onPress}><View style={[styles.checkbox,selected&&styles.checkboxSelected]}>{selected&&<Text style={styles.checkboxTick}>✓</Text>}</View><Text style={styles.choiceText}>{label}</Text></TouchableOpacity>}
function Confirmation({type,id,name,groupSize,groupName,date,time}:{type:Type;id:string;name:string;groupSize:number;groupName:string;date:any;time:string}){return <SafeAreaView style={styles.screen}><ScrollView contentContainerStyle={styles.confirmContent}><View style={styles.successCircle}><Text style={styles.successTick}>✓</Text></View><AutoTranslatedText style={styles.confirmTitle}>Registration Submitted</AutoTranslatedText><Text style={styles.confirmSubtitle}>Your {type==='individual'?'Individual':'Group'} Seva registration has been submitted for admin review.</Text><View style={styles.confirmCard}><AutoTranslatedText style={styles.confirmSmall}>REGISTRATION ID</AutoTranslatedText><Text style={styles.confirmId}>{id}</Text><ConfirmRow label="Registration Type" value={type==='individual'?'Individual Seva':'Group Seva'}/><ConfirmRow label={type==='individual'?'Devotee':'Team Leader'} value={name}/>{type==='group'&&<ConfirmRow label="Team Size" value={`${groupSize} members`}/>} {type==='group'&&groupName?<ConfirmRow label="Group Name" value={groupName}/>:null}<ConfirmRow label="Seva" value="To be assigned by Admin"/><ConfirmRow label="Date" value={`${date.day}, ${date.date} ${date.month} 2026`}/><ConfirmRow label="Time" value={time}/><ConfirmRow label="Status" value="Pending Admin Assignment"/></View><View style={styles.infoBox}><AutoTranslatedText style={styles.infoTitle}>Important</AutoTranslatedText><AutoTranslatedText style={styles.infoText}>Temple admin will review your registration and assign a suitable seva. The assigned seva will appear in My Sevas after approval.</AutoTranslatedText></View><TouchableOpacity style={styles.continueButton} onPress={()=>router.push('/my-sevas')}><AutoTranslatedText style={styles.continueText}>View My Sevas</AutoTranslatedText></TouchableOpacity><TouchableOpacity style={styles.outlineButton} onPress={()=>router.replace('/seva-registration')}><AutoTranslatedText style={styles.outlineText}>Register Another Seva</AutoTranslatedText></TouchableOpacity></ScrollView></SafeAreaView>}
function ConfirmRow({label,value}:{label:string;value:string}){return <View style={styles.confirmRow}><Text style={styles.confirmLabel}>{label}</Text><Text style={styles.confirmValue}>{value}</Text></View>}

const styles=StyleSheet.create({
 screen:{flex:1,backgroundColor:C.bg},topBar:{height:78,backgroundColor:C.purple,flexDirection:'row',alignItems:'center',paddingHorizontal:20},backTop:{width:42,height:42,justifyContent:'center'},backArrow:{color:C.white,fontSize:42,lineHeight:42,fontWeight:'300'},topTitle:{color:C.white,fontSize:23,fontWeight:'600'},typeContent:{padding:20,paddingBottom:50},pageTitle:{color:C.text,fontSize:26,fontWeight:'800',marginTop:8},pageSubtitle:{color:C.muted,fontSize:13,lineHeight:20,marginTop:6,marginBottom:20},typeCard:{minHeight:175,backgroundColor:C.light,borderRadius:28,marginBottom:16,padding:22,flexDirection:'row',alignItems:'flex-start',borderWidth:1,borderColor:'#E7D1F0'},typeIcon:{width:58,height:58,borderRadius:29,backgroundColor:'#E6CFF0',alignItems:'center',justifyContent:'center'},typeIconText:{fontSize:27},typeText:{flex:1,marginLeft:16,paddingTop:3},typeTitle:{color:C.text,fontSize:21,fontWeight:'800'},typeDescription:{color:C.muted,fontSize:13,lineHeight:20,marginTop:16},registerLink:{color:C.purple,fontSize:17,fontWeight:'800',marginTop:16},typeArrow:{color:C.purple,fontSize:35,marginTop:58},formPage:{padding:20,paddingBottom:45},stepHeader:{backgroundColor:C.white,borderRadius:22,padding:18,marginBottom:15,borderWidth:1,borderColor:'#F0E4EA'},stepTitle:{color:C.text,fontSize:24,fontWeight:'800'},stepCount:{color:C.purple,fontSize:9,fontWeight:'800',letterSpacing:1.2,marginTop:5},formCard:{backgroundColor:C.white,paddingHorizontal:8,paddingTop:5},field:{marginBottom:28},label:{color:C.muted,fontSize:17,marginBottom:3},required:{color:C.red,fontSize:19},inputLine:{height:43,borderBottomWidth:2,borderBottomColor:C.line,paddingHorizontal:0,paddingVertical:0,color:C.text,fontSize:17},multiline:{height:80,paddingTop:10,textAlignVertical:'top'},fieldLine:{minHeight:47,borderBottomWidth:2,borderBottomColor:C.line,flexDirection:'row',alignItems:'center',justifyContent:'space-between'},fieldValue:{color:C.text,fontSize:17},placeholder:{color:C.muted},fieldIcon:{color:C.muted,fontSize:28,fontWeight:'700'},optionRow:{flexDirection:'row',flexWrap:'wrap',gap:20,marginTop:7,marginBottom:28},choice:{flexDirection:'row',alignItems:'center',minHeight:38},choiceText:{color:C.muted,fontSize:16,fontWeight:'700',marginLeft:9},radio:{width:24,height:24,borderRadius:12,borderWidth:2,borderColor:C.muted,alignItems:'center',justifyContent:'center'},radioSelected:{borderColor:C.purple},radioDot:{width:12,height:12,borderRadius:6,backgroundColor:C.purple},checkbox:{width:27,height:27,borderRadius:6,borderWidth:2,borderColor:'#1D1D1D',alignItems:'center',justifyContent:'center'},checkboxSelected:{backgroundColor:C.purple,borderColor:C.purple},checkboxTick:{color:C.white,fontSize:18,fontWeight:'800'},bottomButtons:{flexDirection:'row',gap:10,marginTop:22},bottomBack:{flex:1,height:54,borderRadius:28,borderWidth:1.5,borderColor:'#B8B8B8',alignItems:'center',justifyContent:'center',backgroundColor:C.white},bottomBackText:{color:C.purple,fontSize:15,fontWeight:'800'},continueButton:{flex:1,height:54,borderRadius:28,backgroundColor:C.purple,alignItems:'center',justifyContent:'center'},continueText:{color:C.white,fontSize:14,fontWeight:'800'},uploadBox:{borderWidth:1,borderColor:'#DED3E1',borderRadius:15,padding:13,flexDirection:'row',alignItems:'center',marginBottom:28,backgroundColor:'#FFF'},uploadTitle:{color:C.text,fontSize:14,fontWeight:'800'},uploadHint:{color:C.muted,fontSize:10,marginTop:5},uploadButton:{backgroundColor:C.purple,borderRadius:18,paddingHorizontal:14,paddingVertical:9},uploadButtonText:{color:C.white,fontSize:10,fontWeight:'800'},groupInfoTitle:{color:C.text,fontSize:22,fontWeight:'800',marginBottom:10},groupInfo:{color:C.muted,fontSize:13,lineHeight:20,marginBottom:18},minimumBadge:{alignSelf:'flex-start',backgroundColor:C.light,borderRadius:15,paddingHorizontal:12,paddingVertical:7},minimumBadgeText:{color:C.purple,fontSize:9,fontWeight:'800',letterSpacing:1},memberProgress:{backgroundColor:C.white,borderRadius:18,padding:15,flexDirection:'row',justifyContent:'space-between',marginBottom:12,borderWidth:1,borderColor:'#E8DDE8'},memberProgressTitle:{color:C.text,fontSize:18,fontWeight:'800'},memberProgressCount:{color:C.purple,fontSize:12,fontWeight:'800'},memberCard:{backgroundColor:C.white,borderRadius:16,padding:12,marginBottom:9,flexDirection:'row',alignItems:'center',borderWidth:1,borderColor:'#E8DDE8'},memberNumber:{width:34,height:34,borderRadius:17,backgroundColor:C.light,alignItems:'center',justifyContent:'center',marginRight:10},memberNumberText:{color:C.purple,fontWeight:'800'},memberName:{color:C.text,fontSize:14,fontWeight:'800'},memberMeta:{color:C.muted,fontSize:10,marginTop:4},editArrow:{color:C.purple,fontSize:28,marginLeft:8},leaderTag:{color:C.purple,fontSize:7,fontWeight:'900',backgroundColor:C.light,paddingHorizontal:7,paddingVertical:5,borderRadius:9},addMemberButton:{height:56,borderRadius:28,borderWidth:1.5,borderColor:C.purple,backgroundColor:C.white,alignItems:'center',justifyContent:'center',flexDirection:'row'},addMemberPlus:{color:C.purple,fontSize:25},addMemberText:{color:C.purple,fontSize:14,fontWeight:'800'},leaderCard:{backgroundColor:C.white,borderRadius:17,padding:15,marginBottom:10,flexDirection:'row',alignItems:'center',borderWidth:1,borderColor:'#E8DDE8'},leaderCardSelected:{borderColor:C.purple,backgroundColor:'#FAF4FD'},dateCard:{width:75,paddingVertical:13,borderRadius:17,backgroundColor:C.white,alignItems:'center',marginRight:10,borderWidth:1,borderColor:'#D9DDE0'},dateCardSelected:{backgroundColor:C.purple,borderColor:C.purple},dateDay:{color:C.muted,fontSize:9,fontWeight:'800'},dateNumber:{color:C.text,fontSize:23,fontWeight:'800',marginVertical:2},dateMonth:{color:C.purple,fontSize:8,fontWeight:'800'},whiteText:{color:C.white},timeGrid:{flexDirection:'row',flexWrap:'wrap',gap:10,marginBottom:18},timeChip:{width:'31%',minHeight:45,borderRadius:13,backgroundColor:C.white,alignItems:'center',justifyContent:'center',borderWidth:1,borderColor:'#D9DDE0'},timeChipSelected:{backgroundColor:C.purple,borderColor:C.purple},timeText:{color:C.text,fontSize:11,fontWeight:'700'},lockCard:{backgroundColor:C.light,borderRadius:18,padding:14,flexDirection:'row',gap:10,alignItems:'center'},lockIcon:{fontSize:22},lockTitle:{color:C.text,fontSize:12,fontWeight:'800'},lockText:{color:C.muted,fontSize:10,lineHeight:15,marginTop:3},sevaCard:{backgroundColor:C.white,borderRadius:18,padding:13,marginBottom:10,flexDirection:'row',alignItems:'center',borderWidth:1,borderColor:'#E8DDE8'},sevaSelected:{borderColor:C.purple,backgroundColor:'#FAF4FD'},sevaIcon:{width:48,height:48,borderRadius:24,backgroundColor:C.light,alignItems:'center',justifyContent:'center',marginRight:12},sevaName:{color:C.text,fontSize:15,fontWeight:'800'},sevaDesc:{color:C.muted,fontSize:10,lineHeight:15,marginTop:3},sevaDuration:{color:C.purple,fontSize:9,fontWeight:'800',marginTop:4},modalOverlay:{flex:1,backgroundColor:'rgba(0,0,0,0.35)',justifyContent:'flex-end'},modalCard:{backgroundColor:C.white,borderTopLeftRadius:24,borderTopRightRadius:24,padding:18,maxHeight:'70%'},modalHeader:{flexDirection:'row',justifyContent:'space-between',alignItems:'center',marginBottom:8},modalTitle:{color:C.text,fontSize:20,fontWeight:'800'},modalClose:{color:C.purple,fontSize:30},modalOption:{paddingVertical:15,borderBottomWidth:1,borderBottomColor:'#F0E7F1'},modalOptionText:{color:C.text,fontSize:15},memberModal:{backgroundColor:C.white,borderTopLeftRadius:24,borderTopRightRadius:24,padding:18,maxHeight:'92%'},modalSection:{color:C.text,fontSize:20,fontWeight:'800',marginTop:4,marginBottom:20},modalButtons:{flexDirection:'row',gap:10,marginTop:10},successCircle:{width:78,height:78,borderRadius:39,backgroundColor:C.paleGreen,alignSelf:'center',alignItems:'center',justifyContent:'center',marginTop:25,marginBottom:14},successTick:{fontSize:40,color:C.green,fontWeight:'700'},confirmContent:{padding:20,paddingBottom:50},confirmTitle:{textAlign:'center',fontSize:25,fontWeight:'800',color:C.text},confirmSubtitle:{textAlign:'center',fontSize:12,lineHeight:18,color:C.muted,marginTop:6,marginBottom:20},confirmCard:{backgroundColor:C.white,borderRadius:20,padding:17,borderWidth:1,borderColor:'#E8DDE8'},confirmSmall:{textAlign:'center',fontSize:8,fontWeight:'800',letterSpacing:1.3,color:C.purple},confirmId:{textAlign:'center',fontSize:23,fontWeight:'800',color:C.dark,marginVertical:8},confirmRow:{flexDirection:'row',justifyContent:'space-between',paddingVertical:8,borderBottomWidth:1,borderBottomColor:'#F0E7F1'},confirmLabel:{fontSize:10,color:C.muted},confirmValue:{fontSize:11,fontWeight:'800',color:C.text,maxWidth:'62%',textAlign:'right'},infoBox:{backgroundColor:C.light,borderRadius:16,padding:14,marginVertical:15},infoTitle:{fontSize:12,fontWeight:'800',color:C.text,marginBottom:4},infoText:{fontSize:10,lineHeight:16,color:C.muted},outlineButton:{height:54,borderRadius:28,borderWidth:1.5,borderColor:C.purple,alignItems:'center',justifyContent:'center',marginTop:10},outlineText:{color:C.purple,fontSize:14,fontWeight:'800'},
});
