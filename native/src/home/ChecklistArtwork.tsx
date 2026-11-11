import Svg, {Defs,LinearGradient,Stop,Rect,Path,Circle} from 'react-native-svg';
/** Decorative vector artwork stays crisp at different phone sizes. */
export function ChecklistArtwork({quiet=false}:{quiet?:boolean}){
 const id=quiet?'checklist-paper-soft':'checklist-paper-badge';
 return <Svg width={quiet?96:64} height={quiet?72:68} viewBox={quiet?'0 0 140 106':'0 0 116 108'} accessible={false}>
  <Defs><LinearGradient id={id} x1="0" y1="0" x2="1" y2="1"><Stop offset="0" stopColor={quiet?'#c9dfd7':'#62dbca'}/><Stop offset="1" stopColor={quiet?'#91b8af':'#069886'}/></LinearGradient></Defs>
  {quiet?<>
   <Path d="M39 89C16 85 13 66 17 58C33 60 40 75 39 89M105 89C122 82 134 70 128 59C111 62 104 77 105 89" fill="#abd4bd"/>
   <Path d="M39 91C21 96 10 90 7 83C22 77 34 83 39 91M101 92C116 94 130 90 133 83C117 79 105 85 101 92" fill="#c9e3d0"/>
   <Path d="M111 18L114 8M121 25L129 20M124 35L135 36" stroke="#f79b4c" strokeWidth="5" strokeLinecap="round"/>
  </>:<>
   <Path d="M25 21L17 12M40 15L40 5M20 35L9 31" stroke="#f8c52f" strokeWidth="7" strokeLinecap="round"/>
   <Rect x="24" y="26" width="82" height="78" rx="23" fill="#0b685f" opacity=".13"/>
  </>}
  <Rect x={quiet?42:23} y={quiet?30:23} width={quiet?61:82} height={quiet?65:78} rx={quiet?7:23} fill={`url(#${id})`} transform={quiet?'rotate(8 72 62)':undefined}/>
  <Rect x={quiet?49:42} y={quiet?34:40} width={quiet?46:46} height={quiet?54:50} rx="3" fill="#fffdf5" transform={quiet?'rotate(8 72 62)':undefined}/>
  <Rect x={quiet?59:52} y={quiet?26:34} width="26" height="10" rx="3" fill={quiet?'#94bab0':'#ffce4d'}/>
  <Circle cx={quiet?72:65} cy={quiet?25:33} r="4" fill="none" stroke={quiet?'#94bab0':'#ffce4d'} strokeWidth="3"/>
  <Path d={quiet?'M53 47l3 3 6-6M51 60l3 3 6-6M49 73l3 3 6-6':'M48 51l3 3 5-6M48 65l3 3 5-6M48 79l3 3 5-6'} stroke={quiet?'#9fc4b7':'#079d83'} strokeWidth="3" strokeLinecap="round" strokeLinejoin="round" fill="none"/>
  <Path d={quiet?'M68 48h17M66 61h17M64 74h17':'M62 51h17M62 65h17M62 79h17'} stroke={quiet?'#b9d0c9':'#9baeb1'} strokeWidth="3" strokeLinecap="round"/>
 </Svg>;
}
export function ChecklistLandscape({dark}:{dark:boolean}){
 return <Svg width="100%" height="100%" viewBox="0 0 420 260" preserveAspectRatio="none" accessible={false}>
  <Path d="M287 0C329 27 346 8 382 19C400 23 412 35 420 47V0Z" fill="#91cfb7" opacity={dark?.12:.45}/>
  <Path d="M0 201C11 238 42 242 86 242H282C348 240 395 215 420 169V260H0Z" fill="#91c6a6" opacity={dark?.12:.5}/>
 </Svg>;
}
