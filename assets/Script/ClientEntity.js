
cc.Class({
    extends: cc.Component,

    properties: {
        // foo: {
        //    default: null,      // The default value will be used only when the component attaching
        //                           to a node for the first time
        //    url: cc.Texture2D,  // optional, default is typeof default
        //    serializable: true, // optional, default is true
        //    visible: true,      // optional, default is true
        //    displayName: 'Foo', // optional
        //    readonly: false,    // optional, default is false
        // },
        // ...
        typeName: {
            default: '',  
            readonly: true, 
        },
        
        ID: {
            default: '', 
            readonly: true, 
        }
        
    },

    // use this for initialization
    onLoad: function () {
        
    },

    create: function(owner, typeName, entityID, attrs) {
        this.owner = owner 
        this.typeName = typeName
        this.ID = entityID
        this.attrs = attrs 
        this.isPlayer = false
    },

    toString: function() {
        return this.typeName + "<" + this.ID + ">"
    },

    onCreated: function() {
        if (this.typeName == "Account") {
            console.log("Account created, start logining...")
        }
    },

    // called every frame, uncomment this function to activate update callback
    update: function (dt) {
        console.log("GameClient tick")
    },
    
    callServer: function( method ) {
        var args = Array.prototype.slice.call(arguments);
        args = args.slice(1)
        this.owner.callServerMethod( this, method, args )
    },

    onCall: function(method, args) {
        console.log(this.toString()+"."+method+"("+args+")")
        this[method](...args)
    },

    applyMapAttrChange: function(path, key, val) {
        let attr = this.getAttrByPath(path)
        var rootkey = path.length > 0 ? path[0] : key
        attr[key] = val 

        this['onAttrChange_'+rootkey]()
    },
    
    applyMapAttrDel: function(path, key) {
        var rootkey = path.length > 0 ? path[0] : key
        let attr = this.getAttrByPath(path)
        delete attr[key]

        this['onAttrChange_'+rootkey]()
    },

    getAttrByPath: function(path) {
        var attr = this.attrs
        for (var i=0; i< path.length;i++) {
            let key = path[i]
            attr = attr[key]
        }
        return attr 
    },

    onAttrChange_chatroom: function() {
        // chatroom changed
        this.getGoWorld().onChatroomChange( this.attrs.chatroom )
    },

    onBecomePlayer: function() {
        let scene = cc.director.getScene()
        
        console.log("获得玩家对象：", this.toString(), scene.name)
        if (this.typeName == "Avatar") {
            // 玩家登录成功！
            this.getGoWorld().onAvatarLoginSuccess( this )
        } else if (this.typeName == "Account") {
            // 账号创建成功，可以开始登陆
            if (scene.name != "login") {
                cc.director.loadScene("login");
            }
        }
    },

    // Put Client Methods Here 
    ShowError: function(msg) {
        this.getGoWorld().showErrorTip(msg)
    },

    ShowInfo: function(msg) {
        this.getGoWorld().showErrorTip(msg)
    },
    
    OnRecvChat: function(name, text) {
        this.getGoWorld().onRecvChat(name, text)
    },

    getGoWorld: function() {
        let goworld = cc.find("GoWorld").getComponent("GoWorld")
        return goworld
    },
});
