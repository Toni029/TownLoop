/** Editable USD amount: numeric characters plus a single cents separator. */
export function numericPriceInput(value:string):string {
 let digits=value.replace(/[^0-9.,]/g,'');
 // Accept a decimal comma from localized phone keyboards, while retaining
 // ordinary pasted USD grouping such as $1,234.50 or $1,234.
 if(digits.includes('.'))digits=digits.replace(/,/g,'');
 else if(/^[^,]*,[^,]{0,2}$/.test(digits))digits=digits.replace(',','.');
 else digits=digits.replace(/,/g,'');
 const [whole,...fraction]=digits.split('.');
 return whole+(fraction.length?'.'+fraction.join('').slice(0,2):'');
}
export function formatListingPrice(value:string):string {
 const numeric=numericPriceInput(value);
 if(!/[1-9]/.test(numeric))return 'FREE';
 const [whole,cents]=numeric.split('.');
 const dollars=whole.replace(/^0+/,'')||'0';
 return '$'+dollars+(cents?'.'+cents.padEnd(2,'0'):'');
}
