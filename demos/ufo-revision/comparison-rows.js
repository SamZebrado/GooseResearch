/* Exact common paragraphs are synchronization points; a missing paragraph gets its own empty cell. */
(function (global) {
  'use strict';
  function align(before, after) {
    const n=before.length, m=after.length;
    const lcs=Array.from({length:n+1},()=>new Uint16Array(m+1));
    for(let i=n-1;i>=0;i--)for(let j=m-1;j>=0;j--){
      lcs[i][j]=before[i]===after[j]?lcs[i+1][j+1]+1:Math.max(lcs[i+1][j],lcs[i][j+1]);
    }
    const rows=[];let i=0,j=0;
    while(i<n||j<m){
      if(i<n&&j<m&&before[i]===after[j])rows.push({before:before[i++],after:after[j++],kind:'same'});
      else if(j===m||(i<n&&lcs[i+1][j]>=lcs[i][j+1]))rows.push({before:before[i++],after:null,kind:'removed'});
      else rows.push({before:null,after:after[j++],kind:'added'});
    }
    return rows;
  }
  const api=Object.freeze({align});
  if(typeof module!=='undefined'&&module.exports)module.exports=api;
  else global.GooseComparisonRows=api;
})(globalThis);
