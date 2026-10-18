#!/usr/bin/python3
"""Local browser inspection used to verify the installed Spotify customization."""
import socket,struct,os,json,urllib.request,urllib.parse,base64,sys

class CDP:
    def __init__(self, websocket_url=None):
        tabs=json.load(urllib.request.urlopen('http://127.0.0.1:9222/json'))
        tab=next(t for t in tabs if 'xpui.app.spotify.com' in t['url'])
        u=urllib.parse.urlparse(websocket_url or tab['webSocketDebuggerUrl'])
        self.sock=socket.create_connection((u.hostname,u.port),timeout=20)
        key=base64.b64encode(os.urandom(16)).decode()
        self.sock.sendall(('GET '+u.path+' HTTP/1.1\r\nHost: 127.0.0.1:9222\r\nUpgrade: websocket\r\nConnection: Upgrade\r\nSec-WebSocket-Key: '+key+'\r\nSec-WebSocket-Version: 13\r\n\r\n').encode())
        data=b''
        while b'\r\n\r\n' not in data:
            chunk=self.sock.recv(4096)
            if not chunk:raise RuntimeError('Debugger disconnected during handshake')
            data+=chunk
        if not data.startswith(b'HTTP/1.1 101 '):raise RuntimeError(data.decode())
        self.buffer=data.split(b'\r\n\r\n',1)[1];self.seq=0

    def read(self,n):
        while len(self.buffer)<n:
            chunk=self.sock.recv(max(4096,n-len(self.buffer)))
            if not chunk:raise RuntimeError('Debugger disconnected')
            self.buffer+=chunk
        data,self.buffer=self.buffer[:n],self.buffer[n:];return data

    def call(self,method,params={}):
        self.seq+=1
        data=json.dumps({'id':self.seq,'method':method,'params':params}).encode()
        mask=os.urandom(4);length=len(data)
        head=bytes([0x81,0x80|length]) if length<126 else bytes([0x81,0xfe])+struct.pack('!H',length) if length<65536 else bytes([0x81,0xff])+struct.pack('!Q',length)
        self.sock.sendall(head+mask+bytes(b^mask[i%4] for i,b in enumerate(data)))
        while True:
            first,second=self.read(2);length=second&127
            if length==126:length=struct.unpack('!H',self.read(2))[0]
            elif length==127:length=struct.unpack('!Q',self.read(8))[0]
            mask=self.read(4) if second&128 else None
            payload=self.read(length)
            if mask:payload=bytes(b^mask[i%4] for i,b in enumerate(payload))
            if first&15==1:
                result=json.loads(payload)
                if result.get('method') and getattr(self,'on_event',None):self.on_event(result)
                if result.get('id')==self.seq:return result

    def evaluate(self,expression):
        return self.call('Runtime.evaluate',{'expression':expression,'returnByValue':True,'awaitPromise':True})

if __name__=='__main__':
    c=CDP()
    if sys.argv[1]=='screenshot':
        r=c.call('Page.captureScreenshot',{'format':'png'})
        open(sys.argv[2],'wb').write(base64.b64decode(r['result']['data']))
        print('Screenshot saved')
    else: print(json.dumps(c.evaluate(sys.argv[1]),ensure_ascii=False))
