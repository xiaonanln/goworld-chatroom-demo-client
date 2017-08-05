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
        this.player = null
        
        this.sendBuf = new ArrayBuffer(1024*1024)
        this._sendPacket = new DataView(this.sendBuf)
        this._sendPacketWritePos = SIZE_FIELD_SIZE
        
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
        while (true) {
            let payload = this.tryReceivePacket()
            if (payload !== null) {
                this.onReceivePacket(payload)
            } else {
                break 
            }
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
            console.log("gateid", dummy)
            var [dummy, payload] = this.readBytes(payload, CLIENTID_LENGTH) // read ClientID
            console.log("clientid", dummy.length)
        }

        if (msgtype == MT_CREATE_ENTITY_ON_CLIENT) {
            this.handleCreateEntityOnClient(payload)
        } else if (msgtype == MT_CALL_ENTITY_METHOD_ON_CLIENT) {
            this.handleCallEntityMethodOnClient(payload)
        } else if (msgtype == MT_DESTROY_ENTITY_ON_CLIENT) {
            this.handleDestroyEntityOnClient(payload)
        } else if (msgtype == MT_CALL_FILTERED_CLIENTS) {
            this.handleCallFilteredClients(payload)
        }
    },

    handleCreateEntityOnClient: function(payload) {
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
            if (isPlayer) {
                e.isPlayer = true

                if (this.player) {
                    // dupliate player!!!
                    console.error("玩家对象重复：老玩家"+this.player.toString() + "，新玩家：", e.toString())
                }

                this.player = e
            }
            this.onEntityCreated(e)
            e.onCreated()

            if (this.player === e) {
                e.onBecomePlayer()
            }
    },

    handleDestroyEntityOnClient: function(payload) {
		// typeName := packet.ReadVarStr()
		// entityID := packet.ReadEntityID()
        var [typeName, payload] = this.readVarStr(payload)
        var [entityID, payload] = this.readEntityID(payload)
        let e = this.entities[entityID]
        if (e == undefined) {
            return 
        }
        
        delete this.entities[entityID]
        if (this.player === e) {
            this.player = null
            console.log("失去玩家对象：", e.toString()) 
        }
    },

    handleCallEntityMethodOnClient: function(payload) {        
		// entityID := packet.ReadEntityID()
		// method := packet.ReadVarStr()
		// args := packet.ReadArgs()
        var [entityID, payload] = this.readEntityID(payload)
        var [method, payload] = this.readVarStr(payload)
        var [args, payload] = this.readArgs(payload)
        console.log("MT_CALL_ENTITY_METHOD_ON_CLIENT", "entityID", entityID, "method", method, "args", args.length, args)
        let e = this.entities[entityID]
        if (e == undefined) {
            console.log("找不到entity：", entityID)
            return 
        }
        e.onCall( method, args )
    },

    handleCallFilteredClients: function(payload) {
		var [fkey, payload] = this.readVarStr(payload)
		var [fval, payload] = this.readVarStr(payload)
		var [method, payload] = this.readVarStr(payload)
        var [args, payload] = this.readArgs(payload)
        console.log("MT_CALL_FILTERED_CLIENTS", fkey, "=", fval, "method=", method, "args=", args)

        this.player.onCall( method, args )
    },

    readUint8: function(buf) {
        let v = buf.getUint8(0)
        return [v, new DataView(buf.buffer, buf.byteOffset+1)]
    },
    readUint16: function(buf) {
        let v = buf.getUint16(0, true)
        return [v, new DataView(buf.buffer, buf.byteOffset+2)]
    },
    readUint32: function(buf) {
        let v = buf.getUint32(0, true)
        return [v, new DataView(buf.buffer, buf.byteOffset+4)]
    },
    readFloat32: function(buf) {
        let v = buf.getFloat32(0, true)
        return [v, new DataView(buf.buffer, buf.byteOffset+4)]
    },
    readBytes: function(buf, length) {
        let v = new Uint8Array(buf.buffer, buf.byteOffset, length)
        return [v, new DataView(buf.buffer, buf.byteOffset+length)]
    },
    readVarBytes: function(buf) {
        var [n, buf] = this.readUint32(buf)
        var [b, buf] = this.readBytes(buf, n)
        console.log('VarBytes len', n, 'b', b.length)
        return [b, buf]
    },
    readEntityID: function(buf) {
        var [eid, buf] = this.readBytes(buf, ENTITYID_LENGTH)
        eid = this.uint8Array2String(eid)
        return [eid, buf]
    },
    readVarStr: function(buf) {
        var [b, buf] = this.readVarBytes(buf)
        let s = this.uint8Array2String(b)
        return [s, buf]
    },
    readBool: function(buf) {
        var b
        [b, buf] = this.readUint8(buf)
        b = b == 0 ? false : true
        return [b, buf]
    },
    readData: function(buf) {
        var [b, buf] = this.readVarBytes(buf)
        let data = msgpack.decode(b)
        return [data, buf]
    },
    readArgs: function(buf) {
        var [argcount, buf] = this.readUint16(buf)
        console.log("readArgs: argcount", argcount)
        var args = new Array(argcount)
        for (var i = 0; i<argcount; i++) {
            var [data, buf] = this.readData(buf)
            args[i] = data
        }
        return [args, buf]
    },

    appendUint8: function(v) {
        this._sendPacket.setUint8(this._sendPacketWritePos, v)
        this._sendPacketWritePos += 1
    },
    appendUint16: function(v) {
        this._sendPacket.setUint16(this._sendPacketWritePos, v, true)
        this._sendPacketWritePos += 2
    },
    appendUint32: function(v) {
        this._sendPacket.setUint32(this._sendPacketWritePos, v, true)
        this._sendPacketWritePos += 4
    },
    appendBytes: function(b) {
        new Uint8Array(this._sendPacket.buffer, this._sendPacketWritePos, b.length).set(b, 0);  
        this._sendPacketWritePos += b.length
    },
    appendEntityID: function(eid) {
        let b = this.string2Uint8Array(eid)
        console.log("convert", eid, "to", b, b.length)
        this.appendBytes(b)
    },
    appendVarBytes: function(b) {
        this.appendUint32(b.length)
        this.appendBytes(b)
    },
    appendVarStr: function(s) {
        let b = this.string2Uint8Array(s)
        this.appendVarBytes(b)
    },
    appendData: function(data) {
        data = msgpack.encode(data)
        console.log("msgpack encode:", typeof(data), data.length)
        this.appendVarBytes(data)
    },
    appendArgs: function(args) {
        console.log("appendArgs", args.length, args)
        this.appendUint16(args.length)
        for (var i=0; i<args.length;i++) {
            this.appendData(args[i])
        }
    },
    sendPacket: function() {
        let payloadLen = this._sendPacketWritePos - SIZE_FIELD_SIZE
        this._sendPacket.setUint32(0, payloadLen, true)
        let packetLen = this._sendPacketWritePos
        this._sendPacketWritePos = SIZE_FIELD_SIZE
        this.websocket.send(this.sendBuf.slice(0, packetLen))
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
        this.appendVarStr(method)
        this.appendArgs(args)
        this.sendPacket()
    }
    
});
