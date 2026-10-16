import test from 'node:test';
import assert from 'node:assert/strict';
import { dockBubble } from '../src/shell/dockGeometry.ts';
import { ticketTypography } from '../src/workorders/ticketTypography.ts';
import { updateStatus } from '../src/development/updateStatus.ts';
test('all four tab bubbles stay centered at varied widths; News has six-pixel margins', () => {
  for (const width of [280,320,360,400,430]) {
    const cells = [0.23,0.21,0.33,0.23].map(f => f*(width-22)); let x=10;
    for (const [index,name] of ['index','news','workorders','social'].entries()) {
      const layout={x,width:cells[index]}; const bubble=dockBubble(name,width,layout);
      assert.ok(Math.abs(bubble.x+bubble.width/2-(x+layout.width/2))<0.00001);
      if(name==='news'){assert.ok(bubble.x>=x+6-0.00001);assert.ok(bubble.x+bubble.width<=x+layout.width-6+0.00001);}
      x+=layout.width;
    }
  }
});
test('Dotrice four-digit samples fit horizontal and vertical ticket interior', () => {
  for(const code of ['1000','1888','8888','9999','WO-10000','123456789']){
    const t=ticketTypography(code);
    assert.ok(t.fontSize*.72*t.text.length<=51.6+0.001);
    assert.ok(t.lineHeight*t.scaleY<32.8);
    if(t.text.length===4)assert.ok(t.fontSize>17);
  }
  assert.equal(ticketTypography('WO-10000').text,'10000');
});
const idle={isUpdatePending:false,isChecking:false,isDownloading:false,isStartupProcedureRunning:false,isUpdateAvailable:false};
test('OTA status uses real progress and handles ready state hydrated before UI',()=>{
  assert.equal(updateStatus(idle),null);
  assert.equal(updateStatus({...idle,isDownloading:true,downloadProgress:.427})?.progress,42);
  assert.equal(updateStatus({...idle,isDownloading:true})?.progress,null);
  assert.equal(updateStatus({...idle,isDownloading:true,downloadProgress:NaN})?.progress,null);
  assert.equal(updateStatus({...idle,isUpdatePending:true,downloadError:Error()})?.kind,'ready');
  assert.equal(updateStatus({...idle,isChecking:true})?.kind,'checking');
  assert.equal(updateStatus({...idle,downloadError:Error()})?.kind,'error');
});
