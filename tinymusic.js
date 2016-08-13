(function () {
    'use strict';

    const HEADER_STRUCTURE = /^([A-Z]{3})/;
    const NOTE_STRUCTURE = /([A-GX]#?)([1-8])([1-9]{1,2})/g;
    const TWELTH_ROOT_OF_TWO = 1.059463094359;
    const SEMITONES_PER_OCTAVE = 12;
    const CROTCHETS_PER_BAR = 4;

    const zeroNotes = new Map([['C', 16.35], ['C#', 17.32], ['D', 18.35], ['D#', 19.45], ['E', 20.6], ['F', 21.83], ['F#', 23.12], ['G', 24.5], ['G#', 25.96], ['A', 27.5], ['A#', 29.14], ['B', 30.87], ['X', 0]]);

    function TM(instruments, tracks) {
        this.audioContext = new AudioContext();
        this.instruments = instruments;
        this.tracks = tracks;
    }

    TM.prototype.play = function play(trackName) {
        const track = this.tracks[trackName];

        for (let i in track.parts) {
            let instrument = this.instruments[this._parseInstrument(track.parts[i])];
            let frequencies = this._parseFreqs(track.parts[i], track.bpm);
            this._loop(instrument, frequencies);
        }
    };

    TM.prototype._parseInstrument = function _parseInstrument(trackPart) {
        const header = trackPart.match(HEADER_STRUCTURE);
        return header[1];
    }

    TM.prototype._parseFreqs = function _parseFreqs(trackPart, bpm) {
        const frequencies = [];
        let note;

        while ((note = NOTE_STRUCTURE.exec(trackPart))) {
            let name = note[1];
            let octave = note[2];
            let length = note[3];

            frequencies.push({
                length: this._getFreqLength(length, bpm),
                hz: this._convertToFrequency(name, octave, length)
            });
        }

        return frequencies;
    };

    TM.prototype._getFreqLength = function _getFreqLength(length, bpm) {
        const crotchetsPerSecond = bpm / 60;
        return parseInt(length) / crotchetsPerSecond / CROTCHETS_PER_BAR;
    }

    TM.prototype._convertToFrequency = function _convertToFrequency(name, octave, length) {
        const baseFrequency = zeroNotes.get(name);
        return baseFrequency * Math.pow(TWELTH_ROOT_OF_TWO, SEMITONES_PER_OCTAVE * octave);
    };

    TM.prototype._loop = function _loop(instrument, frequencies) {
        const playPromise = frequencies.reduce((promise, freq) => {
            return promise.then(() => this._playFreq(instrument, freq))
        }, Promise.resolve());

        playPromise.then(() => this._loop(instrument, frequencies));
    };

    TM.prototype._playFreq = function _playFreq(instrument, freq) {
        return new Promise(resolve => { 
            const oscillator = this.audioContext.createOscillator();

            oscillator.type = instrument.wave;
            oscillator.frequency.value = freq.hz;

            let nextNode = this._applyGain(oscillator, instrument.gain);
            nextNode = this._applyPan(nextNode, instrument.pan);
            
            nextNode.connect(this.audioContext.destination);

            oscillator.addEventListener('ended', resolve);
            oscillator.start(0);
            oscillator.stop(this.audioContext.currentTime + freq.length);
        });
    };

    TM.prototype._applyGain = function _applyGain(node, gain) {
        return this._applyEffect(node, gain, 'createGain', 'gain');
    };

    TM.prototype._applyPan = function _applyPan(node, pan) {
        return this._applyEffect(node, pan, 'createStereoPanner', 'pan');
    };

    TM.prototype._applyEffect = function _applyEffect(node, val, method, prop) {
        if (!val) {
            return node;
        }

        const nextNode = this.audioContext[method]();
        nextNode[prop].value = val;
        node.connect(nextNode);

        return nextNode;
    };

    this.TM = TM;
}(this));