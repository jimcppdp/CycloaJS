/**
 * マッパーごとの初期化関数
 */
cycloa.VirtualMachine.Mapper = [];
cycloa.VirtualMachine.Mapper[0] = function(self){
	self.writeMapperCPU = function(/* uint8_t */ addr){
		/*do nothing!*/
	};
	var idx = 0;
	for(var i=0; i<32; ++i){
		self.rom[i] = self.prgRom.subarray(idx, idx+=<%= NES::PRG_ROM_BLOCK_SIZE %>);
		if(idx >= self.prgRom.length){
			idx = 0;
		}
	}
	var cidx = 0;
	for(var i=0;i<0x10; ++i){
		self.pattern[i] = self.chrRom.subarray(cidx, cidx += <%= NES::CHR_ROM_BLOCK_SIZE %>);
	}
};

/**
 * ROMを解析してマッパーの初期化などを行う
 * @param {ArrayBuffer} rom
 */
cycloa.VirtualMachine.prototype.load = function(rom){
	this.parseROM(rom);
	// マッパー関数のインジェクション
	var mapperInit = cycloa.VirtualMachine.Mapper[this.mapperNo];
	if(!mapperInit){
		throw new cycloa.err.NotSupportedException("Not supported mapper: "+this.mapperNo);
	}
	mapperInit(this);
	this.__video__changeMirrorType(this.mirrorType);
};

/**
 * ROMをパースしてセットする
 * @param {ArrayBuffer} data
 */
cycloa.VirtualMachine.prototype.parseROM = function(data){
	var data8 = new Uint8Array(data);
	/* check NES data8 */
	if(!(data8[0] === 0x4e && data8[1]===0x45 && data8[2]===0x53 && data8[3] == 0x1a)){
		throw new cycloa.err.CoreException("[FIXME] Invalid header!!");
	}
	this.prgSize = <%= NES::PRG_ROM_PAGE_SIZE %> * data8[4];
	this.chrSize = <%= NES::CHR_ROM_PAGE_SIZE %> * data8[5];
	this.prgPageCnt = data8[4];
	this.chrPageCnt = data8[5];
	this.mapperNo = ((data8[6] & 0xf0)>>4) | (data8[7] & 0xf0);
	this.trainerFlag = (data8[6] & 0x4) === 0x4;
	this.sramFlag = (data8[6] & 0x2) === 0x2;
	if((data8[6] & 0x8) == 0x8){
		this.mirrorType = <%= NES::FOUR_SCREEN %>;
	}else{
		this.mirrorType = (data8[6] & 0x1) == 0x1 ? <%= NES::VERTICAL %> : <%= NES::HORIZONTAL %>;
	}
	/**
	 * @type {number} uint32_t
	 */
	var fptr = 0x10;
	if(this.trainerFlag){
		if(fptr + <%= NES::TRAINER_SIZE %> > data.byteLength) throw new cycloa.err.CoreException("[FIXME] Invalid file size; too short!");
		this.trainer = new Uint8Array(data, fptr, <%= NES::TRAINER_SIZE %>);
		fptr += <%= NES::TRAINER_SIZE %>;
	}
	/* read PRG ROM */
	if(fptr + this.prgSize > data.byteLength) throw new cycloa.err.CoreException("[FIXME] Invalid file size; too short!");
	this.prgRom = new Uint8Array(data, fptr, this.prgSize);
	fptr += this.prgSize;

	if(fptr + this.chrSize > data.byteLength) throw new cycloa.err.CoreException("[FIXME] Invalid file size; too short!");
	else if(fptr + this.chrSize < data.byteLength) throw cycloa.err.CoreException("[FIXME] Invalid file size; too long!");

	this.chrRom = new Uint8Array(data, fptr, this.chrSize);
};


