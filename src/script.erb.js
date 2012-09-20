%# -*- encoding: utf-8 -*-
%require File.expand_path File.dirname(__FILE__)+"/gen.rb";
%MachineName="cycloa.ScriptMachine";

/**
 * スクリプトでプログラムが書ける謎マシン
 * @constructor
 */
<%= MachineName %> = function(videoFairy, audioFairy, pad1Fairy, pad2Fairy) {
this.tracer = new cycloa.Tracer(this);
<%= render File.expand_path File.dirname(__FILE__)+"/vm_cpu_init.erb.js" %>
<%= render File.expand_path File.dirname(__FILE__)+"/vm_video_init.erb.js" %>
<%= render File.expand_path File.dirname(__FILE__)+"/vm_audio_init.erb.js" %>
<%= render (File.expand_path (File.dirname(__FILE__)+"/vm_audio_rectangle_init.erb.js")), :isFirstChannel=>false %>
<%= render (File.expand_path (File.dirname(__FILE__)+"/vm_audio_rectangle_init.erb.js")), :isFirstChannel=>false %>
<%= render File.expand_path File.dirname(__FILE__)+"/vm_audio_triangle_init.erb.js" %>
<%= render File.expand_path File.dirname(__FILE__)+"/vm_audio_noize_init.erb.js" %>
<%= render File.expand_path File.dirname(__FILE__)+"/vm_audio_digital_init.erb.js" %>
<%= render File.expand_path File.dirname(__FILE__)+"/vm_pad_init.erb.js" %>
<%= render File.expand_path File.dirname(__FILE__)+"/vm_mapper_init.erb.js" %>
this.__vm__reservedClockDelta = 0;
/** @type {boolean} */
this.NMI = false;
/** @type {boolean} */
this.IRQ = false;

this.__video__reservedClock = 0;
};

/**
 * VMを１フレーム分実行する
 */
<%= MachineName %>.prototype.run = function () {
	<%= CPU::RunInit() %>
	<%= Video::RunInit() %>
	<%= Audio::RunInit() %>
	var __vm__run = true;
	var __vm__clockDelta;
	var __vm__reservedClockDelta = this.__vm__reservedClockDelta;
	this.__vm__reservedClockDelta = 0;
	var __video__nowY = 0;
	var __video__reservedClock = this.__video__reservedClock;
	var handler;
	while(__vm__run) {
		if(this.NMI){
			handler = this.__handler__['NMI'];
			if(handler){
				handler.call(this.__handler_obj__, __video__nowY,this);
			}
		}
		if(this.IRQ){
			handler = this.__handler__['IRQ'];
			if(handler){
				handler.call(this.__handler_obj__, __video__nowY,this);
			}
		}
		handler = this.__handler__[__video__nowY];
		if(handler){
			handler.call(this.__handler_obj__, __video__nowY,this);
		}
		__vm__clockDelta = __vm__reservedClockDelta; __vm__reservedClockDelta = 0;
		++__video__nowY;
		__video__reservedClock += 341;
		__vm__clockDelta += (__video__reservedClock / <%= Video::ClockFactor %>) | 0;
		__video__reservedClock %= <%= Video::ClockFactor %>;
		if(__video__nowY <= 240){
			/**
			 * @const
			 * @type {Uint8Array}
			 */
			this.__video__spriteEval();
			if(this.__video__backgroundVisibility || this.__video__spriteVisibility) {
				// from http://nocash.emubase.de/everynes.htm#pictureprocessingunitppu
				this.__video__vramAddrRegister = (this.__video__vramAddrRegister & 0x7BE0) | (this.__video__vramAddrReloadRegister & 0x041F);
				this.__video__buildBgLine();
				this.__video__buildSpriteLine();
				var __video__vramAddrRegister = this.__video__vramAddrRegister + (1 << 12);
				__video__vramAddrRegister += (__video__vramAddrRegister & 0x8000) >> 10;
				__video__vramAddrRegister &= 0x7fff;
				if((__video__vramAddrRegister & 0x03e0) === 0x3c0){
					__video__vramAddrRegister &= 0xFC1F;
					__video__vramAddrRegister ^= 0x800;
				}
				this.__video__vramAddrRegister = __video__vramAddrRegister;
			}
		}else if(__video__nowY === 241){
			//241: The PPU just idles during this scanline. Despite this, this scanline still occurs before the VBlank flag is set.
			this.__video__videoFairy.dispatchRendering(__video__screenBuffer8, this.__video__paletteMask);
			__vm__run = false;
			this.__video__nowOnVBnank = true;
			this.__video__spriteAddr = 0;//and typically contains 00h at the begin of the VBlank periods
		}else if(__video__nowY === 242){
			// NESDEV: These occur during VBlank. The VBlank flag of the PPU is pulled low during scanline 241, so the VBlank NMI occurs here.
			// EVERYNES: http://nocash.emubase.de/everynes.htm#ppudimensionstimings
			// とあるものの…BeNesの実装だともっと後に発生すると記述されてる。詳しくは以下。
			// なお、$2002のレジスタがHIGHになった後にVBLANKを起こさないと「ソロモンの鍵」にてゲームが始まらない。
			// (NMI割り込みがレジスタを読み込みフラグをリセットしてしまう上、NMI割り込みが非常に長く、クリアしなくてもすでにVBLANKが終わった後に返ってくる)
			//nowOnVBlankフラグの立ち上がり後、数クロックでNMIが発生。
			this.NMI = this.__video__executeNMIonVBlank; /* reserve NMI if emabled */
			this.onVBlank();
		}else if(__video__nowY <= 261){
			//nowVBlank.
		}else if(__video__nowY === 262){
			this.__video__nowOnVBnank = false;
			this.__video__sprite0Hit = false;
			this.__video__nowY = 0;
			if(!this.__video__isEven){
				this.__video__nowX++;
			}
			this.__video__isEven = !this.__video__isEven;
			// the reload value is automatically loaded into the Pointer at the end of the vblank period (vertical reload bits)
			// from http://nocash.emubase.de/everynes.htm#pictureprocessingunitppu
			if(this.__video__backgroundVisibility || this.__video__spriteVisibility){
				this.__video__vramAddrRegister = (this.__video__vramAddrRegister & 0x041F) | (this.__video__vramAddrReloadRegister & 0x7BE0);
			}
		}else{
			throw new cycloa.err.CoreException("Invalid scanline: "+this.__video__nowY);
		}
	}

	<%= render File.expand_path File.dirname(__FILE__)+"/vm_audio_run.erb.js" %>
	this.__vm__reservedClockDelta += __vm__reservedClockDelta;
	this.__video__reservedClock = __video__reservedClock;
	return __vm__run;
};

/**
 * 関数実行時に
 * @function
 */
<%= MachineName %>.prototype.onHardReset = function () {
	this.NMI = false;
	this.IRQ = 0;
	this.onHardResetCPU();
	this.__video__onHardReset();
	this.__audio__onHardReset();
	this.__rectangle0__onHardReset();
	this.__rectangle1__onHardReset();
	this.__triangle__onHardReset();
	this.__noize__onHardReset();
	this.__digital__onHardReset();
	var handler = this.__handler__['onReset'];
	if(handler){
		handler.call(this.__handler_obj__, 0, this);
	}
};
<%= MachineName %>.prototype.onReset = function () {
	this.NMI = false;
	this.IRQ = 0;
	this.onResetCPU();
	this.__video__onReset();
	this.__audio__onReset();
	this.__rectangle0__onReset();
	this.__rectangle1__onReset();
	this.__triangle__onReset();
	this.__noize__onReset();
	this.__digital__onReset();
	var handler = this.__handler__['onReset'];
	if(handler){
		handler.call(this.__handler_obj__, 0, this);
	}
};
<%= MachineName %>.prototype.onVBlank = function(){
};
<%= MachineName %>.prototype.onIRQ = function(){
};
<%= MachineName %>.prototype.read = function(addr) {
	<%= CPU::UseMemory() %>
	switch((sym & 0xE000) >> 13){
	case 0: /* 0x0000 -> 0x2000 */
		return __cpu__ram[addr & 0x7ff];
	case 1: /* 0x2000 -> 0x4000 */
		return this.__video__readReg(addr);
	case 2: /* 0x4000 -> 0x6000 */
		if(addr === 0x4015){
			/* Clears the frame interrupt flag after being read (but not the DMC interrupt flag).
			   If an interrupt flag was set at the same moment of the read, it will read back as 1 but it will not be cleared. */
			return
				( (this.__rectangle0__lengthCounter != 0 && this.__rectangle0__frequency >= 0x8 && this.__rectangle0__frequency  < 0x800)	? 1 : 0)
				|((this.__rectangle1__lengthCounter != 0 && this.__rectangle1__frequency >= 0x8 && this.__rectangle1__frequency  < 0x800) ? 2 : 0)
				|((this.__triangle__lengthCounter != 0 && this.__triangle__linearCounter != 0) ? 4 : 0)
				|((this.__noize__lengthCounter != 0) ? 8 : 0)
				|((this.__digital__sampleLength != 0) ? 16 : 0)
				|((<%=  CPU::IsIRQPending(CPU::IRQ::FRAMECNT)  %>) ? 64 : 0)
				|(<%=  CPU::IsIRQPending(CPU::IRQ::DMC)  %> ? 128 : 0);
			<%=  CPU::ReleaseIRQ(CPU::IRQ::FRAMECNT)  %>
			<%=  CPU::ReleaseIRQ(CPU::IRQ::DMC)  %>
		}else if(addr === 0x4016){
			return (this.__pad__pad1Fairy.state >> ((this.__pad__pad1Idx++) & 7)) & 0x1;
		}else if(addr === 0x4017){
			return (this.__pad__pad2Fairy.state >> ((this.__pad__pad2Idx++) & 7)) & 0x1;
		}else if(addr < 0x4018){
			throw new cycloa.err.CoreException('[FIXME] Invalid addr: 0x'+addr.toString(16));
		}else{
			return 0;
//            return this.readMapperRegisterArea(addr);
		}
	case 3: /* 0x6000 -> 0x8000 */
		return 0;
	case 4: /* 0x8000 -> 0xA000 */
		return __cpu__rom[(addr>>10) & 31][addr & 0x3ff];
	case 5: /* 0xA000 -> 0xC000 */
		return __cpu__rom[(addr>>10) & 31][addr & 0x3ff];
	case 6: /* 0xC000 -> 0xE000 */
		return __cpu__rom[(addr>>10) & 31][addr & 0x3ff];
	case 7: /* 0xE000 -> 0xffff */
		return __cpu__rom[(addr>>10) & 31][addr & 0x3ff];
	}
};

<%= MachineName %>.prototype.write = function(addr, val) {
	<%= CPU::UseMemory() %>
   	switch((addr & 0xE000) >> 13) {
   	case 0: /* 0x0000 -> 0x2000 */
   		__cpu__ram[addr & 0x1fff] = val;
   		break;
   	case 1: /* 0x2000 -> 0x4000 */
   		this.__video__writeReg(addr, val);
   		break;
   	case 2: /* 0x4000 -> 0x6000 */
   		switch(addr & 0x1f) {
   		case 0x0:  /* 4000h - APU Volume/Decay Channel 1 (Rectangle) */
   			this.__rectangle0__decayCounter = this.__rectangle0__volumeOrDecayRate = val & 15;
   			this.__rectangle0__decayEnabled = (val & 16) == 0;
   			this.__rectangle0__loopEnabled = (val & 32) == 32;
   			switch(val >> 6)
   			{
   			case 0:
   				this.__rectangle0__dutyRatio = 2;
   				break;
   			case 1:
   				this.__rectangle0__dutyRatio = 4;
   				break;
   			case 2:
   				this.__rectangle0__dutyRatio = 8;
   				break;
   			case 3:
   				this.__rectangle0__dutyRatio = 12;
   				break;
   			}
   			break;
   		case 0x1:  /* 4001h - APU Sweep Channel 1 (Rectangle) */
   			this.__rectangle0__sweepShiftAmount = val & 7;
   			this.__rectangle0__sweepIncreased = (val & 0x8) === 0x0;
   			this.__rectangle0__sweepCounter = this.__rectangle0__sweepUpdateRatio = (val >> 4) & 3;
   			this.__rectangle0__sweepEnabled = (val&0x80) === 0x80;
   			break;
   		case 0x2:  /* 4002h - APU Frequency Channel 1 (Rectangle) */
   			this.__rectangle0__frequency = (this.__rectangle0__frequency & 0x0700) | (val);
   			break;
   		case 0x3:  /* 4003h - APU Length Channel 1 (Rectangle) */
   			this.__rectangle0__frequency = (this.__rectangle0__frequency & 0x00ff) | ((val & 7) << 8);
   			this.__rectangle0__lengthCounter = this.__audio__LengthCounterConst[val >> 3];
   			/* Writing to the length registers restarts the length (obviously),
   			   and also restarts the duty cycle (channel 1,2 only), */
   			this.__rectangle0__dutyCounter = 0;
   			/* and restarts the decay volume (channel 1,2,4 only). */
   			this.__rectangle0__decayReloaded = true;
   			break;
   		case 0x4:  /* 4004h - APU Volume/Decay Channel 2 (Rectangle) */
   			this.__rectangle1__decayCounter = this.__rectangle1__volumeOrDecayRate = val & 15;
   			this.__rectangle1__decayEnabled = (val & 16) == 0;
   			this.__rectangle1__loopEnabled = (val & 32) == 32;
   			switch(val >> 6)
   			{
   			case 0:
   				this.__rectangle1__dutyRatio = 2;
   				break;
   			case 1:
   				this.__rectangle1__dutyRatio = 4;
   				break;
   			case 2:
   				this.__rectangle1__dutyRatio = 8;
   				break;
   			case 3:
   				this.__rectangle1__dutyRatio = 12;
   				break;
   			}
   			break;
   		case 0x5:  /* 4005h - APU Sweep Channel 2 (Rectangle) */
   			this.__rectangle1__sweepShiftAmount = val & 7;
   			this.__rectangle1__sweepIncreased = (val & 0x8) === 0x0;
   			this.__rectangle1__sweepCounter = this.__rectangle1__sweepUpdateRatio = (val >> 4) & 3;
   			this.__rectangle1__sweepEnabled = (val&0x80) === 0x80;
   			break;
   		case 0x6:  /* 4006h - APU Frequency Channel 2 (Rectangle) */
   			this.__rectangle1__frequency = (this.__rectangle1__frequency & 0x0700) | (val);
   			break;
   		case 0x7:  /* 4007h - APU Length Channel 2 (Rectangle) */
   			this.__rectangle1__frequency = (this.__rectangle1__frequency & 0x00ff) | ((val & 7) << 8);
   			this.__rectangle1__lengthCounter = this.__audio__LengthCounterConst[val >> 3];
   			/* Writing to the length registers restarts the length (obviously),
   			   and also restarts the duty cycle (channel 1,2 only), */
   			this.__rectangle1__dutyCounter = 0;
   			/* and restarts the decay volume (channel 1,2,4 only). */
   			this.__rectangle1__decayReloaded = true;
   			break;
   		case 0x8:  /* 4008h - APU Linear Counter Channel 3 (Triangle) */
   			this.__triangle__enableLinearCounter = ((val & 128) == 128);
   			this.__triangle__linearCounterBuffer = val & 127;
   			break;
   		case 0x9:  /* 4009h - APU N/A Channel 3 (Triangle) */
   			/* unused */
   			break;
   		case 0xA:  /* 400Ah - APU Frequency Channel 3 (Triangle) */
   			this.__triangle__frequency = (this.__triangle__frequency & 0x0700) | val;
   			break;
   		case 0xB:  /* 400Bh - APU Length Channel 3 (Triangle) */
   			this.__triangle__frequency = (this.__triangle__frequency & 0x00ff) | ((val & 7) << 8);
   			this.__triangle__lengthCounter = this.__audio__LengthCounterConst[val >> 3];
   			/* Side effects 	Sets the halt flag */
   			this.__triangle__haltFlag = true;
   			break;
   		case 0xC:  /* 400Ch - APU Volume/Decay Channel 4 (Noise) */
   			this.__noize__decayCounter = this.__noize__volumeOrDecayRate = val & 15;
   			this.__noize__decayEnabled = (val & 16) == 0;
   			this.__noize__loopEnabled = (val & 32) == 32;
   			break;
   		case 0xd:  /* 400Dh - APU N/A Channel 4 (Noise) */
   			/* unused */
   			break;
   		case 0xe:  /* 400Eh - APU Frequency Channel 4 (Noise) */
   			this.__noize__modeFlag = (val & 128) == 128;
   			this.__noize__frequency = this.__noize__FrequencyTable[val & 15];
   			break;
   		case 0xF: /* 400Fh - APU Length Channel 4 (Noise) */
   			/* Writing to the length registers restarts the length (obviously), */
   			this.__noize__lengthCounter = this.__audio__LengthCounterConst[val >> 3];
   			/* and restarts the decay volume (channel 1,2,4 only). */
   			this.__noize__decayReloaded = true;
   			break;
   			/* ------------------------------------ DMC ----------------------------------------------------- */
   		case 0x10:  /* 4010h - DMC Play mode and DMA frequency */
   			this.__digital__irqEnabled = (val & 128) == 128;
   			if(!this.__digital__irqEnabled){
				<%=  CPU::ReleaseIRQ(CPU::IRQ::DMC)  %>
   			}
   			this.__digital__loopEnabled = (val & 64) == 64;
   			this.__digital__frequency = this.__digital__FrequencyTable[val & 0xf];
   			break;
   		case 0x11:  /* 4011h - DMC Delta counter load register */
   			this.__digital__deltaCounter = val & 0x7f;
   			break;
   		case 0x12:  /* 4012h - DMC address load register */
   			this.__digital__sampleAddr = 0xc000 | (val << 6);
   			break;
   		case 0x13:  /* 4013h - DMC length register */
   			this.__digital__sampleLength = this.__digital__sampleLengthBuffer = (val << 4) | 1;
   			break;
   		case 0x14: /* 4014h execute Sprite DMA */
   			/** @type {number} uint16_t */
   			var __audio__dma__addrMask = val << 8;
   			var __video__spRam = this.__video__spRam;
   			var __video__spriteAddr = this.__video__spriteAddr;
   			for(var i=0;i<256;++i){
   				__video__spRam[(__video__spriteAddr+i) & 0xff] = this.read(__audio__dma__addrmask | i)
   			}
   			__vm__clockDelta += 512;
   			break;
   			/* ------------------------------ CTRL -------------------------------------------------- */
   		case 0x15:  /* __audio__analyzeStatusRegister */
   			if(!(val & 1)) this.__rectangle0__lengthCounter = 0;
   			if(!(val & 2)) this.__rectangle1__lengthCounter = 0;
   			if(!(val & 4)) { this.__triangle__lengthCounter = 0; this.__triangle__linearCounter = this.__triangle__linearCounterBuffer = 0; }
   			if(!(val & 8)) this.__noize__lengthCounter = 0;
   			if(!(val & 16)) { this.__digital__sampleLength = 0; }else if(this.__digital__sampleLength == 0){ this.__digital__sampleLength = this.__digital__sampleLengthBuffer;}
   			break;
   		case 0x16:
   			if((val & 1) === 1){
   				this.__pad__pad1Idx = 0;
   				this.__pad__pad2Idx = 0;
   			}
   			break;
   		case 0x17:  /* __audio__analyzeLowFrequentryRegister */
   			/* Any write to $4017 resets both the frame counter, and the clock divider. */
   			if(val & 0x80) {
   				this.__audio__isNTSCmode = false;
   				this.__audio__frameCnt = <%=  Audio::AUDIO_CLOCK-2*Audio::FRAME_IRQ_RATE  %>;
   				this.__audio__frameIRQCnt = 4;
   			}else{
   				this.__audio__isNTSCmode = true;
   				this.__audio__frameIRQenabled = true;
   				this.__audio__frameCnt = <%=  Audio::AUDIO_CLOCK-2*Audio::FRAME_IRQ_RATE  %>;
   				this.__audio__frameIRQCnt = 3;
   			}
   			if((val & 0x40) === 0x40){
   				this.__audio__frameIRQenabled = false;
				<%=  CPU::ReleaseIRQ(CPU::IRQ::FRAMECNT)  %>
   			}
   			break;
   		default:
   			/* this.writeMapperRegisterArea(addr, val); */
   			break;
		}
		break;
   		case 3: /* 0x6000 -> 0x8000 */
   			break;
   		case 4: /* 0x8000 -> 0xA000 */
			__cpu__rom[(addr>>10) & 31][addr & 0x3ff] = val;
   			break;
   		case 5: /* 0xA000 -> 0xC000 */
			__cpu__rom[(addr>>10) & 31][addr & 0x3ff] = val;
   			break;
   		case 6: /* 0xC000 -> 0xE000 */
			__cpu__rom[(addr>>10) & 31][addr & 0x3ff] = val;
   			break;
   		case 7: /* 0xE000 -> 0xffff */
			__cpu__rom[(addr>>10) & 31][addr & 0x3ff] = val;
   			break;
   		}
};

<%= MachineName %>.prototype.load = function(script) {
	this.__handler__ = {};
	this.__handler_obj__ = {};
	for(var i=0;i<32;++i){
		this.__cpu__rom[i] = new Uint8Array(1024);
	}
	this.__cpu__rom
	eval(script);
};

<%= MachineName %>.prototype.registerHandler = function(e, func) {
	this.__handler__[e] = func;
}

<%= MachineName %>.prototype.removeHandler = function(e) {
	delete this.__handler__[e];
}

<%= MachineName %>.prototype.invokeScript = function(scanline) {
}

<%= render File.expand_path File.dirname(__FILE__)+"/vm_cpu_method.erb.js" %>
<%= render File.expand_path File.dirname(__FILE__)+"/vm_video_method.erb.js" %>
<%= render File.expand_path File.dirname(__FILE__)+"/vm_audio_method.erb.js" %>
<%= render (File.expand_path (File.dirname(__FILE__)+"/vm_audio_rectangle_method.erb.js")), :isFirstChannel=>false %>
<%= render (File.expand_path (File.dirname(__FILE__)+"/vm_audio_rectangle_method.erb.js")), :isFirstChannel=>true %>
<%= render File.expand_path File.dirname(__FILE__)+"/vm_audio_triangle_method.erb.js" %>
<%= render File.expand_path File.dirname(__FILE__)+"/vm_audio_noize_method.erb.js" %>
<%= render File.expand_path File.dirname(__FILE__)+"/vm_audio_digital_method.erb.js" %>

