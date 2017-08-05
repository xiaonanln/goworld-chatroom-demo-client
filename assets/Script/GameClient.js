var msgpack = require("msgpack");
var ClientEntity = require("ClientEntity")

const _RECV_PAYLOAD_LENGTH = 1
const _RECV_PAYLOAD = 2

const CLIENTID_LENGTH = 16
const ENTITYID_LENGTH = 16

const SIZE_FIELD_SIZE = 4

const MT_INVALID = 0
// Server Messages
const MT_SET_GAME_ID = 1
const MT_SET_GATE_ID = 2
const MT_NOTIFY_CREATE_ENTITY = 3
const MT_NOTIFY_DESTROY_ENTITY = 4
const MT_DECLARE_SERVICE = 5
const MT_UNDECLARE_SERVICE = 6
const MT_CALL_ENTITY_METHOD = 7
const MT_CREATE_ENTITY_ANYWHERE = 8
const MT_LOAD_ENTITY_ANYWHERE = 9
const MT_NOTIFY_CLIENT_CONNECTED = 10
const MT_NOTIFY_CLIENT_DISCONNECTED = 11
const MT_CALL_ENTITY_METHOD_FROM_CLIENT = 12
const MT_SYNC_POSITION_YAW_FROM_CLIENT = 13
const MT_NOTIFY_ALL_GAMES_CONNECTED = 14
const MT_NOTIFY_GATE_DISCONNECTED = 15
const MT_START_FREEZE_GAME = 16
const MT_START_FREEZE_GAME_ACK = 17
// Message types for migrating
const MT_MIGRATE_REQUEST = 18
const MT_REAL_MIGRATE = 19

const MT_GATE_SERVICE_MSG_TYPE_START = 1000
const MT_REDIRECT_TO_GATEPROXY_MSG_TYPE_START = 1001 // messages that should be redirected to client proxy
const MT_CREATE_ENTITY_ON_CLIENT = 1002
const MT_DESTROY_ENTITY_ON_CLIENT = 1003
const MT_NOTIFY_MAP_ATTR_CHANGE_ON_CLIENT = 1004
const MT_NOTIFY_MAP_ATTR_DEL_ON_CLIENT = 1005
const MT_NOTIFY_LIST_ATTR_CHANGE_ON_CLIENT = 1006
const MT_NOTIFY_LIST_ATTR_POP_ON_CLIENT = 1007
const MT_NOTIFY_LIST_ATTR_APPEND_ON_CLIENT = 1008
const MT_CALL_ENTITY_METHOD_ON_CLIENT = 1009
const MT_UPDATE_POSITION_ON_CLIENT = 1010
const MT_UPDATE_YAW_ON_CLIENT = 1011
const MT_SET_CLIENTPROXY_FILTER_PROP = 1012
const MT_CLEAR_CLIENTPROXY_FILTER_PROPS = 1013

// add more ...

const MT_REDIRECT_TO_GATEPROXY_MSG_TYPE_STOP = 1500

const MT_CALL_FILTERED_CLIENTS = 1501
const MT_SYNC_POSITION_YAW_ON_CLIENTS = 1502

// add more ...

const MT_GATE_SERVICE_MSG_TYPE_STOP = 2000


cc.Class({
    extends: cc.Component,

    properties: {
        serverAddr: {
            default: '',
        },
        serverPort: {
            default: '',
        },
    },

    // use this for initialization
    onLoad: function () {
        this.recvBuf = new ArrayBuffer()
        this.recvStatus = _RECV_PAYLOAD_LENGTH
        this.recvPayloadLen = 0
        this.entities = {}
        
        this.sendBuf = new ArrayBuffer(1024*1024)
        this.sendBufWritePos = SIZE_FIELD_SIZE
        
        this.connect()
    },

    // called every frame, uncomment this function to activate update callback
    update: function (dt) {

    },

    onRecvData: function (data) {
        if (this.recvBuf.byteLength == 0) {
            this.recvBuf = data
        } else {
            var tmp = new Uint8Array( this.recvBuf.byteLength + data.byteLength );
            tmp.set( new Uint8Array( this.recvBuf ), 0 );
            tmp.set( new Uint8Array( data ), this.recvBuf.byteLength );
            this.recvBuf = tmp.buffer
        }

        console.log("未处理数据：", this.recvBuf.byteLength)
        let payload = this.tryReceivePacket()
        if (payload !== null) {
            this.onReceivePacket(payload)
        }
    },

    // 从已经收到的数据（recvBuf）里解析出数据包（Packet）
    tryReceivePacket: function() {
        let recvBufView = new DataView(this.recvBuf)
        if (this.recvStatus == _RECV_PAYLOAD_LENGTH) {
            if (this.recvBuf.byteLength < SIZE_FIELD_SIZE) {
                return null
            }
            this.recvPayloadLen = recvBufView.getUint32(0, true)
            console.log("数据包大小: ", this.recvPayloadLen)
            this.recvStatus = _RECV_PAYLOAD
        }

        // recv status == _RECV_PAYLOAD
        console.log("包大小：", this.recvPayloadLen, "现有数据：", this.recvBuf.byteLength - SIZE_FIELD_SIZE)
        if (this.recvBuf.byteLength - SIZE_FIELD_SIZE < this.recvPayloadLen) {
            // payload not enough
            return null
        }

        // 足够了，返回包数据
        var payload = this.recvBuf.slice(SIZE_FIELD_SIZE, SIZE_FIELD_SIZE+this.recvPayloadLen)
        this.recvBuf = this.recvBuf.slice(SIZE_FIELD_SIZE+this.recvPayloadLen)
        // 恢复到接收长度状态
        this.recvStatus = _RECV_PAYLOAD_LENGTH
        this.recvPayloadLen = 0
        return payload
    },

    onReceivePacket: function (payload) {
        // payload is ArrayBuffer
        payload = new DataView(payload) // 转换为DataView便于操作
        var [msgtype, payload] = this.readUint16(payload)
        console.log("收到包：", payload, payload.byteLength, "，消息类型：", msgtype)
        if (msgtype != MT_CALL_FILTERED_CLIENTS && msgtype != MT_SYNC_POSITION_YAW_ON_CLIENTS) {
            var [dummy, payload] = this.readUint16(payload)
            var [dummy, payload] = this.readBytes(payload, CLIENTID_LENGTH) // read ClientID
        }

        if (msgtype == MT_CREATE_ENTITY_ON_CLIENT) {
            var [isPlayer, payload] = this.readBool(payload)
            var [eid, payload] = this.readEntityID(payload)
            var [typeName, payload] = this.readVarStr(payload)
            var [x, payload] = this.readFloat32(payload)
            var [y, payload] = this.readFloat32(payload)
            var [z, payload] = this.readFloat32(payload)
            var [yaw, payload] = this.readFloat32(payload)
            var [clientData,payload] = this.readVarBytes(payload)
            clientData = msgpack.decode(clientData)
            console.log("MT_CREATE_ENTITY_ON_CLIENT", "isPlayer", isPlayer, 'eid', eid,"typeName", typeName, 'position', x, y, z, 'yaw', yaw, 'clientData', JSON.stringify(clientData))
            
            var e = new ClientEntity()
            e.create( this, typeName, eid )
            this.entities[eid] = e
            this.onEntityCreated(e)
            e.onCreated()
        }
    },

    readUint8: function(buf) {
        let v = new Uint8Array(buf)[0]
        return [v, buf.slice(1)]
    },
    readUint16: function(buf) {
        let v = new Uint16Array(buf.slice(0, 2))[0]
        return [v, buf.slice(2)]
    },
    readUint32: function(buf) {
        let v = new Uint32Array(buf.slice(0, 4))[0]
        return [v, buf.slice(4)]
    },
    readFloat32: function(buf) {
        let v = new Float32Array(buf.slice(0, 4))[0]
        return [v, buf.slice(4)]
    },
    readBytes: function(buf, length) {
        let v = new Uint8Array(buf.slice(0, length))
        return [v, buf.slice(length)]
    },
    readVarBytes: function(buf) {
        var [n, buf] = this.readUint32(buf)
        var [b, buf] = this.readBytes(buf, n)
        return [b, buf]
    },
    readEntityID: function(buf) {
        var [eid, buf] = this.readBytes(buf, ENTITYID_LENGTH)
        eid = String.fromCharCode.apply(null, eid)
        return [eid, buf]
    },
    readVarStr: function(buf) {
        var [b, buf] = this.readVarBytes(buf)
        let s = String.fromCharCode.apply(null, b)
        return [s, buf]
    },
    readBool: function(buf) {
        var b
        [b, buf] = this.readUint8(buf)
        b = b == 0 ? false : true
        return [b, buf]
    },

    appendUint8: function(v) {
        let slice = this.sendBuf.slice(this.sendBufWritePos, this.sendBufWritePos+1)
        new Uint8Array(slice)[0] = v
        this.sendBufWritePos += 1
    },
    appendUint16: function(v) {
        let slice = this.sendBuf.slice(this.sendBufWritePos, this.sendBufWritePos+2)
        new Uint16Array(slice)[0] = v
        this.sendBufWritePos += 2
    },
    appendBytes: function(b) {
        var slice = this.sendBuf.slice(this.sendBufWritePos, this.sendBufWritePos+b.length)
        console.log("appendBytes", b.length, slice.byteLength, "sendBufWritePos", this.sendBufWritePos)
        new Uint8Array(slice).set(b, 0);  
        this.sendBufWritePos += b.length
    },
    appendEntityID: function(eid) {
        let b = this.string2Uint8Array(eid)
        console.log("convert", eid, "to", b, b.length)
        this.appendBytes(b)
    },
    sendPacket: function() {
        let payload = this.sendBuf.slice(SIZE_FIELD_SIZE, this.sendBufWritePos)
        let payloadLen = payload.byteLength
        new Uint32Array(this.sendBuf.slice(0, SIZE_FIELD_SIZE))[0] = payloadLen
        let packet = this.sendBuf.slice(0, this.sendBufWritePos)
        
        this.sendBufWritePos = SIZE_FIELD_SIZE
        
        console.log("writing packet", packet.byteLength, 
            "payloadLen", payloadLen, "packetPayloadLen",
            new Uint32Array(packet.slice(0, SIZE_FIELD_SIZE))[0])
        this.websocket.send(packet)
    },
    
    string2Uint8Array: function(str) {
      let bufView = new Uint8Array(str.length);
      for (var i=0, strLen=str.length; i<strLen; i++) {
        bufView[i] = str.charCodeAt(i);
      }
      return bufView;
    },
    uint8Array2String: function(b) {
        return String.fromCharCode.apply(null, b)
    },

    connect: function() {
        var serverAddr = 'ws://'+this.serverAddr+':'+this.serverPort+'/ws'
        console.log("正在连接 " + serverAddr + ' ...')
        var websocket = new WebSocket(serverAddr)
        this.websocket = websocket
        
        websocket.binaryType = 'arraybuffer'
        console.log(websocket)
        var gameclient = this

          //连接发生错误的回调方法
          websocket.onerror = function () {
               console.log("WebSocket连接发生错误");
          };

           //连接成功建立的回调方法
           websocket.onopen = function () {
               console.log("WebSocket连接成功");
           }

          //接收到消息的回调方法
           websocket.onmessage = function (event) {
               var data = event.data
               console.log("收到数据：", typeof(data), data.length);
               gameclient.onRecvData(data)
          }

           //连接关闭的回调方法
           websocket.onclose = function () {
              console.log("WebSocket连接关闭");
           }

           //监听窗口关闭事件，当窗口关闭时，主动去关闭websocket连接，防止连接还没断开就关闭窗口，server端会抛异常。
           window.onbeforeunload = function () {
               console.log("onbeforeunload");
           }
    },
    
    onEntityCreated: function(e) {
        console.log("entity created:", e.toString())
    },
    
    getEntity: function(entityID) {
        return this.entities[entityID]
    },
    
    getEntityByType: function(typeName) {
        for (var eid in this.entities) {
            let e = this.entities[eid]
            if (e.typeName == typeName) {
                return e
            }
        }
        return null 
    },
    
    callServerMethod: function(entity, method, args) {
        console.log(">>> "+entity.toString()+"."+method+"("+args+")")
        // 	packet.AppendUint16(MT_CALL_ENTITY_METHOD_FROM_CLIENT)
        // 	packet.AppendEntityID(id)
        // 	packet.AppendVarStr(method)
        // 	packet.AppendArgs(args)

        this.appendUint16(MT_CALL_ENTITY_METHOD_FROM_CLIENT)
        this.appendEntityID(entity.ID)
        this.sendPacket()
    }
    
});
