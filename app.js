/*
QR Code Generator for JavaScript 1.4.4
https://github.com/kazuhikoarase/qrcode-generator
Copyright (c) 2009 Kazuhiko Arase

MIT License

Permission is hereby granted, free of charge, to any person obtaining a copy
of this software and associated documentation files (the "Software"), to deal
in the Software without restriction, including without limitation the rights
to use, copy, modify, merge, publish, distribute, sublicense, and/or sell
copies of the Software, and to permit persons to whom the Software is
furnished to do so, subject to the following conditions:

The above copyright notice and this permission notice shall be included in
all copies or substantial portions of the Software.

THE SOFTWARE IS PROVIDED "AS IS", WITHOUT WARRANTY OF ANY KIND, EXPRESS OR
IMPLIED, INCLUDING BUT NOT LIMITED TO THE WARRANTIES OF MERCHANTABILITY,
FITNESS FOR A PARTICULAR PURPOSE AND NONINFRINGEMENT. IN NO EVENT SHALL THE
AUTHORS OR COPYRIGHT HOLDERS BE LIABLE FOR ANY CLAIM, DAMAGES OR OTHER
LIABILITY, WHETHER IN AN ACTION OF CONTRACT, TORT OR OTHERWISE, ARISING FROM,
OUT OF OR IN CONNECTION WITH THE SOFTWARE OR THE USE OR OTHER DEALINGS IN
THE SOFTWARE.
*/
/* QR Code generator 1.4.4, Copyright (c) 2009 Kazuhiko Arase, MIT License. */
var HS30LineQR=(function(){
//---------------------------------------------------------------------
//
// QR Code Generator for JavaScript
//
// Copyright (c) 2009 Kazuhiko Arase
//
// URL: http://www.d-project.com/
//
// Licensed under the MIT license:
//  http://www.opensource.org/licenses/mit-license.php
//
// The word 'QR Code' is registered trademark of
// DENSO WAVE INCORPORATED
//  http://www.denso-wave.com/qrcode/faqpatent-e.html
//
//---------------------------------------------------------------------

var qrcode = function() {

  //---------------------------------------------------------------------
  // qrcode
  //---------------------------------------------------------------------

  /**
   * qrcode
   * @param typeNumber 1 to 40
   * @param errorCorrectionLevel 'L','M','Q','H'
   */
  var qrcode = function(typeNumber, errorCorrectionLevel) {

    var PAD0 = 0xEC;
    var PAD1 = 0x11;

    var _typeNumber = typeNumber;
    var _errorCorrectionLevel = QRErrorCorrectionLevel[errorCorrectionLevel];
    var _modules = null;
    var _moduleCount = 0;
    var _dataCache = null;
    var _dataList = [];

    var _this = {};

    var makeImpl = function(test, maskPattern) {

      _moduleCount = _typeNumber * 4 + 17;
      _modules = function(moduleCount) {
        var modules = new Array(moduleCount);
        for (var row = 0; row < moduleCount; row += 1) {
          modules[row] = new Array(moduleCount);
          for (var col = 0; col < moduleCount; col += 1) {
            modules[row][col] = null;
          }
        }
        return modules;
      }(_moduleCount);

      setupPositionProbePattern(0, 0);
      setupPositionProbePattern(_moduleCount - 7, 0);
      setupPositionProbePattern(0, _moduleCount - 7);
      setupPositionAdjustPattern();
      setupTimingPattern();
      setupTypeInfo(test, maskPattern);

      if (_typeNumber >= 7) {
        setupTypeNumber(test);
      }

      if (_dataCache == null) {
        _dataCache = createData(_typeNumber, _errorCorrectionLevel, _dataList);
      }

      mapData(_dataCache, maskPattern);
    };

    var setupPositionProbePattern = function(row, col) {

      for (var r = -1; r <= 7; r += 1) {

        if (row + r <= -1 || _moduleCount <= row + r) continue;

        for (var c = -1; c <= 7; c += 1) {

          if (col + c <= -1 || _moduleCount <= col + c) continue;

          if ( (0 <= r && r <= 6 && (c == 0 || c == 6) )
              || (0 <= c && c <= 6 && (r == 0 || r == 6) )
              || (2 <= r && r <= 4 && 2 <= c && c <= 4) ) {
            _modules[row + r][col + c] = true;
          } else {
            _modules[row + r][col + c] = false;
          }
        }
      }
    };

    var getBestMaskPattern = function() {

      var minLostPoint = 0;
      var pattern = 0;

      for (var i = 0; i < 8; i += 1) {

        makeImpl(true, i);

        var lostPoint = QRUtil.getLostPoint(_this);

        if (i == 0 || minLostPoint > lostPoint) {
          minLostPoint = lostPoint;
          pattern = i;
        }
      }

      return pattern;
    };

    var setupTimingPattern = function() {

      for (var r = 8; r < _moduleCount - 8; r += 1) {
        if (_modules[r][6] != null) {
          continue;
        }
        _modules[r][6] = (r % 2 == 0);
      }

      for (var c = 8; c < _moduleCount - 8; c += 1) {
        if (_modules[6][c] != null) {
          continue;
        }
        _modules[6][c] = (c % 2 == 0);
      }
    };

    var setupPositionAdjustPattern = function() {

      var pos = QRUtil.getPatternPosition(_typeNumber);

      for (var i = 0; i < pos.length; i += 1) {

        for (var j = 0; j < pos.length; j += 1) {

          var row = pos[i];
          var col = pos[j];

          if (_modules[row][col] != null) {
            continue;
          }

          for (var r = -2; r <= 2; r += 1) {

            for (var c = -2; c <= 2; c += 1) {

              if (r == -2 || r == 2 || c == -2 || c == 2
                  || (r == 0 && c == 0) ) {
                _modules[row + r][col + c] = true;
              } else {
                _modules[row + r][col + c] = false;
              }
            }
          }
        }
      }
    };

    var setupTypeNumber = function(test) {

      var bits = QRUtil.getBCHTypeNumber(_typeNumber);

      for (var i = 0; i < 18; i += 1) {
        var mod = (!test && ( (bits >> i) & 1) == 1);
        _modules[Math.floor(i / 3)][i % 3 + _moduleCount - 8 - 3] = mod;
      }

      for (var i = 0; i < 18; i += 1) {
        var mod = (!test && ( (bits >> i) & 1) == 1);
        _modules[i % 3 + _moduleCount - 8 - 3][Math.floor(i / 3)] = mod;
      }
    };

    var setupTypeInfo = function(test, maskPattern) {

      var data = (_errorCorrectionLevel << 3) | maskPattern;
      var bits = QRUtil.getBCHTypeInfo(data);

      // vertical
      for (var i = 0; i < 15; i += 1) {

        var mod = (!test && ( (bits >> i) & 1) == 1);

        if (i < 6) {
          _modules[i][8] = mod;
        } else if (i < 8) {
          _modules[i + 1][8] = mod;
        } else {
          _modules[_moduleCount - 15 + i][8] = mod;
        }
      }

      // horizontal
      for (var i = 0; i < 15; i += 1) {

        var mod = (!test && ( (bits >> i) & 1) == 1);

        if (i < 8) {
          _modules[8][_moduleCount - i - 1] = mod;
        } else if (i < 9) {
          _modules[8][15 - i - 1 + 1] = mod;
        } else {
          _modules[8][15 - i - 1] = mod;
        }
      }

      // fixed module
      _modules[_moduleCount - 8][8] = (!test);
    };

    var mapData = function(data, maskPattern) {

      var inc = -1;
      var row = _moduleCount - 1;
      var bitIndex = 7;
      var byteIndex = 0;
      var maskFunc = QRUtil.getMaskFunction(maskPattern);

      for (var col = _moduleCount - 1; col > 0; col -= 2) {

        if (col == 6) col -= 1;

        while (true) {

          for (var c = 0; c < 2; c += 1) {

            if (_modules[row][col - c] == null) {

              var dark = false;

              if (byteIndex < data.length) {
                dark = ( ( (data[byteIndex] >>> bitIndex) & 1) == 1);
              }

              var mask = maskFunc(row, col - c);

              if (mask) {
                dark = !dark;
              }

              _modules[row][col - c] = dark;
              bitIndex -= 1;

              if (bitIndex == -1) {
                byteIndex += 1;
                bitIndex = 7;
              }
            }
          }

          row += inc;

          if (row < 0 || _moduleCount <= row) {
            row -= inc;
            inc = -inc;
            break;
          }
        }
      }
    };

    var createBytes = function(buffer, rsBlocks) {

      var offset = 0;

      var maxDcCount = 0;
      var maxEcCount = 0;

      var dcdata = new Array(rsBlocks.length);
      var ecdata = new Array(rsBlocks.length);

      for (var r = 0; r < rsBlocks.length; r += 1) {

        var dcCount = rsBlocks[r].dataCount;
        var ecCount = rsBlocks[r].totalCount - dcCount;

        maxDcCount = Math.max(maxDcCount, dcCount);
        maxEcCount = Math.max(maxEcCount, ecCount);

        dcdata[r] = new Array(dcCount);

        for (var i = 0; i < dcdata[r].length; i += 1) {
          dcdata[r][i] = 0xff & buffer.getBuffer()[i + offset];
        }
        offset += dcCount;

        var rsPoly = QRUtil.getErrorCorrectPolynomial(ecCount);
        var rawPoly = qrPolynomial(dcdata[r], rsPoly.getLength() - 1);

        var modPoly = rawPoly.mod(rsPoly);
        ecdata[r] = new Array(rsPoly.getLength() - 1);
        for (var i = 0; i < ecdata[r].length; i += 1) {
          var modIndex = i + modPoly.getLength() - ecdata[r].length;
          ecdata[r][i] = (modIndex >= 0)? modPoly.getAt(modIndex) : 0;
        }
      }

      var totalCodeCount = 0;
      for (var i = 0; i < rsBlocks.length; i += 1) {
        totalCodeCount += rsBlocks[i].totalCount;
      }

      var data = new Array(totalCodeCount);
      var index = 0;

      for (var i = 0; i < maxDcCount; i += 1) {
        for (var r = 0; r < rsBlocks.length; r += 1) {
          if (i < dcdata[r].length) {
            data[index] = dcdata[r][i];
            index += 1;
          }
        }
      }

      for (var i = 0; i < maxEcCount; i += 1) {
        for (var r = 0; r < rsBlocks.length; r += 1) {
          if (i < ecdata[r].length) {
            data[index] = ecdata[r][i];
            index += 1;
          }
        }
      }

      return data;
    };

    var createData = function(typeNumber, errorCorrectionLevel, dataList) {

      var rsBlocks = QRRSBlock.getRSBlocks(typeNumber, errorCorrectionLevel);

      var buffer = qrBitBuffer();

      for (var i = 0; i < dataList.length; i += 1) {
        var data = dataList[i];
        buffer.put(data.getMode(), 4);
        buffer.put(data.getLength(), QRUtil.getLengthInBits(data.getMode(), typeNumber) );
        data.write(buffer);
      }

      // calc num max data.
      var totalDataCount = 0;
      for (var i = 0; i < rsBlocks.length; i += 1) {
        totalDataCount += rsBlocks[i].dataCount;
      }

      if (buffer.getLengthInBits() > totalDataCount * 8) {
        throw 'code length overflow. ('
          + buffer.getLengthInBits()
          + '>'
          + totalDataCount * 8
          + ')';
      }

      // end code
      if (buffer.getLengthInBits() + 4 <= totalDataCount * 8) {
        buffer.put(0, 4);
      }

      // padding
      while (buffer.getLengthInBits() % 8 != 0) {
        buffer.putBit(false);
      }

      // padding
      while (true) {

        if (buffer.getLengthInBits() >= totalDataCount * 8) {
          break;
        }
        buffer.put(PAD0, 8);

        if (buffer.getLengthInBits() >= totalDataCount * 8) {
          break;
        }
        buffer.put(PAD1, 8);
      }

      return createBytes(buffer, rsBlocks);
    };

    _this.addData = function(data, mode) {

      mode = mode || 'Byte';

      var newData = null;

      switch(mode) {
      case 'Numeric' :
        newData = qrNumber(data);
        break;
      case 'Alphanumeric' :
        newData = qrAlphaNum(data);
        break;
      case 'Byte' :
        newData = qr8BitByte(data);
        break;
      case 'Kanji' :
        newData = qrKanji(data);
        break;
      default :
        throw 'mode:' + mode;
      }

      _dataList.push(newData);
      _dataCache = null;
    };

    _this.isDark = function(row, col) {
      if (row < 0 || _moduleCount <= row || col < 0 || _moduleCount <= col) {
        throw row + ',' + col;
      }
      return _modules[row][col];
    };

    _this.getModuleCount = function() {
      return _moduleCount;
    };

    _this.make = function() {
      if (_typeNumber < 1) {
        var typeNumber = 1;

        for (; typeNumber < 40; typeNumber++) {
          var rsBlocks = QRRSBlock.getRSBlocks(typeNumber, _errorCorrectionLevel);
          var buffer = qrBitBuffer();

          for (var i = 0; i < _dataList.length; i++) {
            var data = _dataList[i];
            buffer.put(data.getMode(), 4);
            buffer.put(data.getLength(), QRUtil.getLengthInBits(data.getMode(), typeNumber) );
            data.write(buffer);
          }

          var totalDataCount = 0;
          for (var i = 0; i < rsBlocks.length; i++) {
            totalDataCount += rsBlocks[i].dataCount;
          }

          if (buffer.getLengthInBits() <= totalDataCount * 8) {
            break;
          }
        }

        _typeNumber = typeNumber;
      }

      makeImpl(false, getBestMaskPattern() );
    };

    _this.createTableTag = function(cellSize, margin) {

      cellSize = cellSize || 2;
      margin = (typeof margin == 'undefined')? cellSize * 4 : margin;

      var qrHtml = '';

      qrHtml += '<table style="';
      qrHtml += ' border-width: 0px; border-style: none;';
      qrHtml += ' border-collapse: collapse;';
      qrHtml += ' padding: 0px; margin: ' + margin + 'px;';
      qrHtml += '">';
      qrHtml += '<tbody>';

      for (var r = 0; r < _this.getModuleCount(); r += 1) {

        qrHtml += '<tr>';

        for (var c = 0; c < _this.getModuleCount(); c += 1) {
          qrHtml += '<td style="';
          qrHtml += ' border-width: 0px; border-style: none;';
          qrHtml += ' border-collapse: collapse;';
          qrHtml += ' padding: 0px; margin: 0px;';
          qrHtml += ' width: ' + cellSize + 'px;';
          qrHtml += ' height: ' + cellSize + 'px;';
          qrHtml += ' background-color: ';
          qrHtml += _this.isDark(r, c)? '#000000' : '#ffffff';
          qrHtml += ';';
          qrHtml += '"/>';
        }

        qrHtml += '</tr>';
      }

      qrHtml += '</tbody>';
      qrHtml += '</table>';

      return qrHtml;
    };

    _this.createSvgTag = function(cellSize, margin, alt, title) {

      var opts = {};
      if (typeof arguments[0] == 'object') {
        // Called by options.
        opts = arguments[0];
        // overwrite cellSize and margin.
        cellSize = opts.cellSize;
        margin = opts.margin;
        alt = opts.alt;
        title = opts.title;
      }

      cellSize = cellSize || 2;
      margin = (typeof margin == 'undefined')? cellSize * 4 : margin;

      // Compose alt property surrogate
      alt = (typeof alt === 'string') ? {text: alt} : alt || {};
      alt.text = alt.text || null;
      alt.id = (alt.text) ? alt.id || 'qrcode-description' : null;

      // Compose title property surrogate
      title = (typeof title === 'string') ? {text: title} : title || {};
      title.text = title.text || null;
      title.id = (title.text) ? title.id || 'qrcode-title' : null;

      var size = _this.getModuleCount() * cellSize + margin * 2;
      var c, mc, r, mr, qrSvg='', rect;

      rect = 'l' + cellSize + ',0 0,' + cellSize +
        ' -' + cellSize + ',0 0,-' + cellSize + 'z ';

      qrSvg += '<svg version="1.1" xmlns="http://www.w3.org/2000/svg"';
      qrSvg += !opts.scalable ? ' width="' + size + 'px" height="' + size + 'px"' : '';
      qrSvg += ' viewBox="0 0 ' + size + ' ' + size + '" ';
      qrSvg += ' preserveAspectRatio="xMinYMin meet"';
      qrSvg += (title.text || alt.text) ? ' role="img" aria-labelledby="' +
          escapeXml([title.id, alt.id].join(' ').trim() ) + '"' : '';
      qrSvg += '>';
      qrSvg += (title.text) ? '<title id="' + escapeXml(title.id) + '">' +
          escapeXml(title.text) + '</title>' : '';
      qrSvg += (alt.text) ? '<description id="' + escapeXml(alt.id) + '">' +
          escapeXml(alt.text) + '</description>' : '';
      qrSvg += '<rect width="100%" height="100%" fill="white" cx="0" cy="0"/>';
      qrSvg += '<path d="';

      for (r = 0; r < _this.getModuleCount(); r += 1) {
        mr = r * cellSize + margin;
        for (c = 0; c < _this.getModuleCount(); c += 1) {
          if (_this.isDark(r, c) ) {
            mc = c*cellSize+margin;
            qrSvg += 'M' + mc + ',' + mr + rect;
          }
        }
      }

      qrSvg += '" stroke="transparent" fill="black"/>';
      qrSvg += '</svg>';

      return qrSvg;
    };

    _this.createDataURL = function(cellSize, margin) {

      cellSize = cellSize || 2;
      margin = (typeof margin == 'undefined')? cellSize * 4 : margin;

      var size = _this.getModuleCount() * cellSize + margin * 2;
      var min = margin;
      var max = size - margin;

      return createDataURL(size, size, function(x, y) {
        if (min <= x && x < max && min <= y && y < max) {
          var c = Math.floor( (x - min) / cellSize);
          var r = Math.floor( (y - min) / cellSize);
          return _this.isDark(r, c)? 0 : 1;
        } else {
          return 1;
        }
      } );
    };

    _this.createImgTag = function(cellSize, margin, alt) {

      cellSize = cellSize || 2;
      margin = (typeof margin == 'undefined')? cellSize * 4 : margin;

      var size = _this.getModuleCount() * cellSize + margin * 2;

      var img = '';
      img += '<img';
      img += '\u0020src="';
      img += _this.createDataURL(cellSize, margin);
      img += '"';
      img += '\u0020width="';
      img += size;
      img += '"';
      img += '\u0020height="';
      img += size;
      img += '"';
      if (alt) {
        img += '\u0020alt="';
        img += escapeXml(alt);
        img += '"';
      }
      img += '/>';

      return img;
    };

    var escapeXml = function(s) {
      var escaped = '';
      for (var i = 0; i < s.length; i += 1) {
        var c = s.charAt(i);
        switch(c) {
        case '<': escaped += '&lt;'; break;
        case '>': escaped += '&gt;'; break;
        case '&': escaped += '&amp;'; break;
        case '"': escaped += '&quot;'; break;
        default : escaped += c; break;
        }
      }
      return escaped;
    };

    var _createHalfASCII = function(margin) {
      var cellSize = 1;
      margin = (typeof margin == 'undefined')? cellSize * 2 : margin;

      var size = _this.getModuleCount() * cellSize + margin * 2;
      var min = margin;
      var max = size - margin;

      var y, x, r1, r2, p;

      var blocks = {
        '██': '█',
        '█ ': '▀',
        ' █': '▄',
        '  ': ' '
      };

      var blocksLastLineNoMargin = {
        '██': '▀',
        '█ ': '▀',
        ' █': ' ',
        '  ': ' '
      };

      var ascii = '';
      for (y = 0; y < size; y += 2) {
        r1 = Math.floor((y - min) / cellSize);
        r2 = Math.floor((y + 1 - min) / cellSize);
        for (x = 0; x < size; x += 1) {
          p = '█';

          if (min <= x && x < max && min <= y && y < max && _this.isDark(r1, Math.floor((x - min) / cellSize))) {
            p = ' ';
          }

          if (min <= x && x < max && min <= y+1 && y+1 < max && _this.isDark(r2, Math.floor((x - min) / cellSize))) {
            p += ' ';
          }
          else {
            p += '█';
          }

          // Output 2 characters per pixel, to create full square. 1 character per pixels gives only half width of square.
          ascii += (margin < 1 && y+1 >= max) ? blocksLastLineNoMargin[p] : blocks[p];
        }

        ascii += '\n';
      }

      if (size % 2 && margin > 0) {
        return ascii.substring(0, ascii.length - size - 1) + Array(size+1).join('▀');
      }

      return ascii.substring(0, ascii.length-1);
    };

    _this.createASCII = function(cellSize, margin) {
      cellSize = cellSize || 1;

      if (cellSize < 2) {
        return _createHalfASCII(margin);
      }

      cellSize -= 1;
      margin = (typeof margin == 'undefined')? cellSize * 2 : margin;

      var size = _this.getModuleCount() * cellSize + margin * 2;
      var min = margin;
      var max = size - margin;

      var y, x, r, p;

      var white = Array(cellSize+1).join('██');
      var black = Array(cellSize+1).join('  ');

      var ascii = '';
      var line = '';
      for (y = 0; y < size; y += 1) {
        r = Math.floor( (y - min) / cellSize);
        line = '';
        for (x = 0; x < size; x += 1) {
          p = 1;

          if (min <= x && x < max && min <= y && y < max && _this.isDark(r, Math.floor((x - min) / cellSize))) {
            p = 0;
          }

          // Output 2 characters per pixel, to create full square. 1 character per pixels gives only half width of square.
          line += p ? white : black;
        }

        for (r = 0; r < cellSize; r += 1) {
          ascii += line + '\n';
        }
      }

      return ascii.substring(0, ascii.length-1);
    };

    _this.renderTo2dContext = function(context, cellSize) {
      cellSize = cellSize || 2;
      var length = _this.getModuleCount();
      for (var row = 0; row < length; row++) {
        for (var col = 0; col < length; col++) {
          context.fillStyle = _this.isDark(row, col) ? 'black' : 'white';
          context.fillRect(row * cellSize, col * cellSize, cellSize, cellSize);
        }
      }
    }

    return _this;
  };

  //---------------------------------------------------------------------
  // qrcode.stringToBytes
  //---------------------------------------------------------------------

  qrcode.stringToBytesFuncs = {
    'default' : function(s) {
      var bytes = [];
      for (var i = 0; i < s.length; i += 1) {
        var c = s.charCodeAt(i);
        bytes.push(c & 0xff);
      }
      return bytes;
    }
  };

  qrcode.stringToBytes = qrcode.stringToBytesFuncs['default'];

  //---------------------------------------------------------------------
  // qrcode.createStringToBytes
  //---------------------------------------------------------------------

  /**
   * @param unicodeData base64 string of byte array.
   * [16bit Unicode],[16bit Bytes], ...
   * @param numChars
   */
  qrcode.createStringToBytes = function(unicodeData, numChars) {

    // create conversion map.

    var unicodeMap = function() {

      var bin = base64DecodeInputStream(unicodeData);
      var read = function() {
        var b = bin.read();
        if (b == -1) throw 'eof';
        return b;
      };

      var count = 0;
      var unicodeMap = {};
      while (true) {
        var b0 = bin.read();
        if (b0 == -1) break;
        var b1 = read();
        var b2 = read();
        var b3 = read();
        var k = String.fromCharCode( (b0 << 8) | b1);
        var v = (b2 << 8) | b3;
        unicodeMap[k] = v;
        count += 1;
      }
      if (count != numChars) {
        throw count + ' != ' + numChars;
      }

      return unicodeMap;
    }();

    var unknownChar = '?'.charCodeAt(0);

    return function(s) {
      var bytes = [];
      for (var i = 0; i < s.length; i += 1) {
        var c = s.charCodeAt(i);
        if (c < 128) {
          bytes.push(c);
        } else {
          var b = unicodeMap[s.charAt(i)];
          if (typeof b == 'number') {
            if ( (b & 0xff) == b) {
              // 1byte
              bytes.push(b);
            } else {
              // 2bytes
              bytes.push(b >>> 8);
              bytes.push(b & 0xff);
            }
          } else {
            bytes.push(unknownChar);
          }
        }
      }
      return bytes;
    };
  };

  //---------------------------------------------------------------------
  // QRMode
  //---------------------------------------------------------------------

  var QRMode = {
    MODE_NUMBER :    1 << 0,
    MODE_ALPHA_NUM : 1 << 1,
    MODE_8BIT_BYTE : 1 << 2,
    MODE_KANJI :     1 << 3
  };

  //---------------------------------------------------------------------
  // QRErrorCorrectionLevel
  //---------------------------------------------------------------------

  var QRErrorCorrectionLevel = {
    L : 1,
    M : 0,
    Q : 3,
    H : 2
  };

  //---------------------------------------------------------------------
  // QRMaskPattern
  //---------------------------------------------------------------------

  var QRMaskPattern = {
    PATTERN000 : 0,
    PATTERN001 : 1,
    PATTERN010 : 2,
    PATTERN011 : 3,
    PATTERN100 : 4,
    PATTERN101 : 5,
    PATTERN110 : 6,
    PATTERN111 : 7
  };

  //---------------------------------------------------------------------
  // QRUtil
  //---------------------------------------------------------------------

  var QRUtil = function() {

    var PATTERN_POSITION_TABLE = [
      [],
      [6, 18],
      [6, 22],
      [6, 26],
      [6, 30],
      [6, 34],
      [6, 22, 38],
      [6, 24, 42],
      [6, 26, 46],
      [6, 28, 50],
      [6, 30, 54],
      [6, 32, 58],
      [6, 34, 62],
      [6, 26, 46, 66],
      [6, 26, 48, 70],
      [6, 26, 50, 74],
      [6, 30, 54, 78],
      [6, 30, 56, 82],
      [6, 30, 58, 86],
      [6, 34, 62, 90],
      [6, 28, 50, 72, 94],
      [6, 26, 50, 74, 98],
      [6, 30, 54, 78, 102],
      [6, 28, 54, 80, 106],
      [6, 32, 58, 84, 110],
      [6, 30, 58, 86, 114],
      [6, 34, 62, 90, 118],
      [6, 26, 50, 74, 98, 122],
      [6, 30, 54, 78, 102, 126],
      [6, 26, 52, 78, 104, 130],
      [6, 30, 56, 82, 108, 134],
      [6, 34, 60, 86, 112, 138],
      [6, 30, 58, 86, 114, 142],
      [6, 34, 62, 90, 118, 146],
      [6, 30, 54, 78, 102, 126, 150],
      [6, 24, 50, 76, 102, 128, 154],
      [6, 28, 54, 80, 106, 132, 158],
      [6, 32, 58, 84, 110, 136, 162],
      [6, 26, 54, 82, 110, 138, 166],
      [6, 30, 58, 86, 114, 142, 170]
    ];
    var G15 = (1 << 10) | (1 << 8) | (1 << 5) | (1 << 4) | (1 << 2) | (1 << 1) | (1 << 0);
    var G18 = (1 << 12) | (1 << 11) | (1 << 10) | (1 << 9) | (1 << 8) | (1 << 5) | (1 << 2) | (1 << 0);
    var G15_MASK = (1 << 14) | (1 << 12) | (1 << 10) | (1 << 4) | (1 << 1);

    var _this = {};

    var getBCHDigit = function(data) {
      var digit = 0;
      while (data != 0) {
        digit += 1;
        data >>>= 1;
      }
      return digit;
    };

    _this.getBCHTypeInfo = function(data) {
      var d = data << 10;
      while (getBCHDigit(d) - getBCHDigit(G15) >= 0) {
        d ^= (G15 << (getBCHDigit(d) - getBCHDigit(G15) ) );
      }
      return ( (data << 10) | d) ^ G15_MASK;
    };

    _this.getBCHTypeNumber = function(data) {
      var d = data << 12;
      while (getBCHDigit(d) - getBCHDigit(G18) >= 0) {
        d ^= (G18 << (getBCHDigit(d) - getBCHDigit(G18) ) );
      }
      return (data << 12) | d;
    };

    _this.getPatternPosition = function(typeNumber) {
      return PATTERN_POSITION_TABLE[typeNumber - 1];
    };

    _this.getMaskFunction = function(maskPattern) {

      switch (maskPattern) {

      case QRMaskPattern.PATTERN000 :
        return function(i, j) { return (i + j) % 2 == 0; };
      case QRMaskPattern.PATTERN001 :
        return function(i, j) { return i % 2 == 0; };
      case QRMaskPattern.PATTERN010 :
        return function(i, j) { return j % 3 == 0; };
      case QRMaskPattern.PATTERN011 :
        return function(i, j) { return (i + j) % 3 == 0; };
      case QRMaskPattern.PATTERN100 :
        return function(i, j) { return (Math.floor(i / 2) + Math.floor(j / 3) ) % 2 == 0; };
      case QRMaskPattern.PATTERN101 :
        return function(i, j) { return (i * j) % 2 + (i * j) % 3 == 0; };
      case QRMaskPattern.PATTERN110 :
        return function(i, j) { return ( (i * j) % 2 + (i * j) % 3) % 2 == 0; };
      case QRMaskPattern.PATTERN111 :
        return function(i, j) { return ( (i * j) % 3 + (i + j) % 2) % 2 == 0; };

      default :
        throw 'bad maskPattern:' + maskPattern;
      }
    };

    _this.getErrorCorrectPolynomial = function(errorCorrectLength) {
      var a = qrPolynomial([1], 0);
      for (var i = 0; i < errorCorrectLength; i += 1) {
        a = a.multiply(qrPolynomial([1, QRMath.gexp(i)], 0) );
      }
      return a;
    };

    _this.getLengthInBits = function(mode, type) {

      if (1 <= type && type < 10) {

        // 1 - 9

        switch(mode) {
        case QRMode.MODE_NUMBER    : return 10;
        case QRMode.MODE_ALPHA_NUM : return 9;
        case QRMode.MODE_8BIT_BYTE : return 8;
        case QRMode.MODE_KANJI     : return 8;
        default :
          throw 'mode:' + mode;
        }

      } else if (type < 27) {

        // 10 - 26

        switch(mode) {
        case QRMode.MODE_NUMBER    : return 12;
        case QRMode.MODE_ALPHA_NUM : return 11;
        case QRMode.MODE_8BIT_BYTE : return 16;
        case QRMode.MODE_KANJI     : return 10;
        default :
          throw 'mode:' + mode;
        }

      } else if (type < 41) {

        // 27 - 40

        switch(mode) {
        case QRMode.MODE_NUMBER    : return 14;
        case QRMode.MODE_ALPHA_NUM : return 13;
        case QRMode.MODE_8BIT_BYTE : return 16;
        case QRMode.MODE_KANJI     : return 12;
        default :
          throw 'mode:' + mode;
        }

      } else {
        throw 'type:' + type;
      }
    };

    _this.getLostPoint = function(qrcode) {

      var moduleCount = qrcode.getModuleCount();

      var lostPoint = 0;

      // LEVEL1

      for (var row = 0; row < moduleCount; row += 1) {
        for (var col = 0; col < moduleCount; col += 1) {

          var sameCount = 0;
          var dark = qrcode.isDark(row, col);

          for (var r = -1; r <= 1; r += 1) {

            if (row + r < 0 || moduleCount <= row + r) {
              continue;
            }

            for (var c = -1; c <= 1; c += 1) {

              if (col + c < 0 || moduleCount <= col + c) {
                continue;
              }

              if (r == 0 && c == 0) {
                continue;
              }

              if (dark == qrcode.isDark(row + r, col + c) ) {
                sameCount += 1;
              }
            }
          }

          if (sameCount > 5) {
            lostPoint += (3 + sameCount - 5);
          }
        }
      };

      // LEVEL2

      for (var row = 0; row < moduleCount - 1; row += 1) {
        for (var col = 0; col < moduleCount - 1; col += 1) {
          var count = 0;
          if (qrcode.isDark(row, col) ) count += 1;
          if (qrcode.isDark(row + 1, col) ) count += 1;
          if (qrcode.isDark(row, col + 1) ) count += 1;
          if (qrcode.isDark(row + 1, col + 1) ) count += 1;
          if (count == 0 || count == 4) {
            lostPoint += 3;
          }
        }
      }

      // LEVEL3

      for (var row = 0; row < moduleCount; row += 1) {
        for (var col = 0; col < moduleCount - 6; col += 1) {
          if (qrcode.isDark(row, col)
              && !qrcode.isDark(row, col + 1)
              &&  qrcode.isDark(row, col + 2)
              &&  qrcode.isDark(row, col + 3)
              &&  qrcode.isDark(row, col + 4)
              && !qrcode.isDark(row, col + 5)
              &&  qrcode.isDark(row, col + 6) ) {
            lostPoint += 40;
          }
        }
      }

      for (var col = 0; col < moduleCount; col += 1) {
        for (var row = 0; row < moduleCount - 6; row += 1) {
          if (qrcode.isDark(row, col)
              && !qrcode.isDark(row + 1, col)
              &&  qrcode.isDark(row + 2, col)
              &&  qrcode.isDark(row + 3, col)
              &&  qrcode.isDark(row + 4, col)
              && !qrcode.isDark(row + 5, col)
              &&  qrcode.isDark(row + 6, col) ) {
            lostPoint += 40;
          }
        }
      }

      // LEVEL4

      var darkCount = 0;

      for (var col = 0; col < moduleCount; col += 1) {
        for (var row = 0; row < moduleCount; row += 1) {
          if (qrcode.isDark(row, col) ) {
            darkCount += 1;
          }
        }
      }

      var ratio = Math.abs(100 * darkCount / moduleCount / moduleCount - 50) / 5;
      lostPoint += ratio * 10;

      return lostPoint;
    };

    return _this;
  }();

  //---------------------------------------------------------------------
  // QRMath
  //---------------------------------------------------------------------

  var QRMath = function() {

    var EXP_TABLE = new Array(256);
    var LOG_TABLE = new Array(256);

    // initialize tables
    for (var i = 0; i < 8; i += 1) {
      EXP_TABLE[i] = 1 << i;
    }
    for (var i = 8; i < 256; i += 1) {
      EXP_TABLE[i] = EXP_TABLE[i - 4]
        ^ EXP_TABLE[i - 5]
        ^ EXP_TABLE[i - 6]
        ^ EXP_TABLE[i - 8];
    }
    for (var i = 0; i < 255; i += 1) {
      LOG_TABLE[EXP_TABLE[i] ] = i;
    }

    var _this = {};

    _this.glog = function(n) {

      if (n < 1) {
        throw 'glog(' + n + ')';
      }

      return LOG_TABLE[n];
    };

    _this.gexp = function(n) {

      while (n < 0) {
        n += 255;
      }

      while (n >= 256) {
        n -= 255;
      }

      return EXP_TABLE[n];
    };

    return _this;
  }();

  //---------------------------------------------------------------------
  // qrPolynomial
  //---------------------------------------------------------------------

  function qrPolynomial(num, shift) {

    if (typeof num.length == 'undefined') {
      throw num.length + '/' + shift;
    }

    var _num = function() {
      var offset = 0;
      while (offset < num.length && num[offset] == 0) {
        offset += 1;
      }
      var _num = new Array(num.length - offset + shift);
      for (var i = 0; i < num.length - offset; i += 1) {
        _num[i] = num[i + offset];
      }
      return _num;
    }();

    var _this = {};

    _this.getAt = function(index) {
      return _num[index];
    };

    _this.getLength = function() {
      return _num.length;
    };

    _this.multiply = function(e) {

      var num = new Array(_this.getLength() + e.getLength() - 1);

      for (var i = 0; i < _this.getLength(); i += 1) {
        for (var j = 0; j < e.getLength(); j += 1) {
          num[i + j] ^= QRMath.gexp(QRMath.glog(_this.getAt(i) ) + QRMath.glog(e.getAt(j) ) );
        }
      }

      return qrPolynomial(num, 0);
    };

    _this.mod = function(e) {

      if (_this.getLength() - e.getLength() < 0) {
        return _this;
      }

      var ratio = QRMath.glog(_this.getAt(0) ) - QRMath.glog(e.getAt(0) );

      var num = new Array(_this.getLength() );
      for (var i = 0; i < _this.getLength(); i += 1) {
        num[i] = _this.getAt(i);
      }

      for (var i = 0; i < e.getLength(); i += 1) {
        num[i] ^= QRMath.gexp(QRMath.glog(e.getAt(i) ) + ratio);
      }

      // recursive call
      return qrPolynomial(num, 0).mod(e);
    };

    return _this;
  };

  //---------------------------------------------------------------------
  // QRRSBlock
  //---------------------------------------------------------------------

  var QRRSBlock = function() {

    var RS_BLOCK_TABLE = [

      // L
      // M
      // Q
      // H

      // 1
      [1, 26, 19],
      [1, 26, 16],
      [1, 26, 13],
      [1, 26, 9],

      // 2
      [1, 44, 34],
      [1, 44, 28],
      [1, 44, 22],
      [1, 44, 16],

      // 3
      [1, 70, 55],
      [1, 70, 44],
      [2, 35, 17],
      [2, 35, 13],

      // 4
      [1, 100, 80],
      [2, 50, 32],
      [2, 50, 24],
      [4, 25, 9],

      // 5
      [1, 134, 108],
      [2, 67, 43],
      [2, 33, 15, 2, 34, 16],
      [2, 33, 11, 2, 34, 12],

      // 6
      [2, 86, 68],
      [4, 43, 27],
      [4, 43, 19],
      [4, 43, 15],

      // 7
      [2, 98, 78],
      [4, 49, 31],
      [2, 32, 14, 4, 33, 15],
      [4, 39, 13, 1, 40, 14],

      // 8
      [2, 121, 97],
      [2, 60, 38, 2, 61, 39],
      [4, 40, 18, 2, 41, 19],
      [4, 40, 14, 2, 41, 15],

      // 9
      [2, 146, 116],
      [3, 58, 36, 2, 59, 37],
      [4, 36, 16, 4, 37, 17],
      [4, 36, 12, 4, 37, 13],

      // 10
      [2, 86, 68, 2, 87, 69],
      [4, 69, 43, 1, 70, 44],
      [6, 43, 19, 2, 44, 20],
      [6, 43, 15, 2, 44, 16],

      // 11
      [4, 101, 81],
      [1, 80, 50, 4, 81, 51],
      [4, 50, 22, 4, 51, 23],
      [3, 36, 12, 8, 37, 13],

      // 12
      [2, 116, 92, 2, 117, 93],
      [6, 58, 36, 2, 59, 37],
      [4, 46, 20, 6, 47, 21],
      [7, 42, 14, 4, 43, 15],

      // 13
      [4, 133, 107],
      [8, 59, 37, 1, 60, 38],
      [8, 44, 20, 4, 45, 21],
      [12, 33, 11, 4, 34, 12],

      // 14
      [3, 145, 115, 1, 146, 116],
      [4, 64, 40, 5, 65, 41],
      [11, 36, 16, 5, 37, 17],
      [11, 36, 12, 5, 37, 13],

      // 15
      [5, 109, 87, 1, 110, 88],
      [5, 65, 41, 5, 66, 42],
      [5, 54, 24, 7, 55, 25],
      [11, 36, 12, 7, 37, 13],

      // 16
      [5, 122, 98, 1, 123, 99],
      [7, 73, 45, 3, 74, 46],
      [15, 43, 19, 2, 44, 20],
      [3, 45, 15, 13, 46, 16],

      // 17
      [1, 135, 107, 5, 136, 108],
      [10, 74, 46, 1, 75, 47],
      [1, 50, 22, 15, 51, 23],
      [2, 42, 14, 17, 43, 15],

      // 18
      [5, 150, 120, 1, 151, 121],
      [9, 69, 43, 4, 70, 44],
      [17, 50, 22, 1, 51, 23],
      [2, 42, 14, 19, 43, 15],

      // 19
      [3, 141, 113, 4, 142, 114],
      [3, 70, 44, 11, 71, 45],
      [17, 47, 21, 4, 48, 22],
      [9, 39, 13, 16, 40, 14],

      // 20
      [3, 135, 107, 5, 136, 108],
      [3, 67, 41, 13, 68, 42],
      [15, 54, 24, 5, 55, 25],
      [15, 43, 15, 10, 44, 16],

      // 21
      [4, 144, 116, 4, 145, 117],
      [17, 68, 42],
      [17, 50, 22, 6, 51, 23],
      [19, 46, 16, 6, 47, 17],

      // 22
      [2, 139, 111, 7, 140, 112],
      [17, 74, 46],
      [7, 54, 24, 16, 55, 25],
      [34, 37, 13],

      // 23
      [4, 151, 121, 5, 152, 122],
      [4, 75, 47, 14, 76, 48],
      [11, 54, 24, 14, 55, 25],
      [16, 45, 15, 14, 46, 16],

      // 24
      [6, 147, 117, 4, 148, 118],
      [6, 73, 45, 14, 74, 46],
      [11, 54, 24, 16, 55, 25],
      [30, 46, 16, 2, 47, 17],

      // 25
      [8, 132, 106, 4, 133, 107],
      [8, 75, 47, 13, 76, 48],
      [7, 54, 24, 22, 55, 25],
      [22, 45, 15, 13, 46, 16],

      // 26
      [10, 142, 114, 2, 143, 115],
      [19, 74, 46, 4, 75, 47],
      [28, 50, 22, 6, 51, 23],
      [33, 46, 16, 4, 47, 17],

      // 27
      [8, 152, 122, 4, 153, 123],
      [22, 73, 45, 3, 74, 46],
      [8, 53, 23, 26, 54, 24],
      [12, 45, 15, 28, 46, 16],

      // 28
      [3, 147, 117, 10, 148, 118],
      [3, 73, 45, 23, 74, 46],
      [4, 54, 24, 31, 55, 25],
      [11, 45, 15, 31, 46, 16],

      // 29
      [7, 146, 116, 7, 147, 117],
      [21, 73, 45, 7, 74, 46],
      [1, 53, 23, 37, 54, 24],
      [19, 45, 15, 26, 46, 16],

      // 30
      [5, 145, 115, 10, 146, 116],
      [19, 75, 47, 10, 76, 48],
      [15, 54, 24, 25, 55, 25],
      [23, 45, 15, 25, 46, 16],

      // 31
      [13, 145, 115, 3, 146, 116],
      [2, 74, 46, 29, 75, 47],
      [42, 54, 24, 1, 55, 25],
      [23, 45, 15, 28, 46, 16],

      // 32
      [17, 145, 115],
      [10, 74, 46, 23, 75, 47],
      [10, 54, 24, 35, 55, 25],
      [19, 45, 15, 35, 46, 16],

      // 33
      [17, 145, 115, 1, 146, 116],
      [14, 74, 46, 21, 75, 47],
      [29, 54, 24, 19, 55, 25],
      [11, 45, 15, 46, 46, 16],

      // 34
      [13, 145, 115, 6, 146, 116],
      [14, 74, 46, 23, 75, 47],
      [44, 54, 24, 7, 55, 25],
      [59, 46, 16, 1, 47, 17],

      // 35
      [12, 151, 121, 7, 152, 122],
      [12, 75, 47, 26, 76, 48],
      [39, 54, 24, 14, 55, 25],
      [22, 45, 15, 41, 46, 16],

      // 36
      [6, 151, 121, 14, 152, 122],
      [6, 75, 47, 34, 76, 48],
      [46, 54, 24, 10, 55, 25],
      [2, 45, 15, 64, 46, 16],

      // 37
      [17, 152, 122, 4, 153, 123],
      [29, 74, 46, 14, 75, 47],
      [49, 54, 24, 10, 55, 25],
      [24, 45, 15, 46, 46, 16],

      // 38
      [4, 152, 122, 18, 153, 123],
      [13, 74, 46, 32, 75, 47],
      [48, 54, 24, 14, 55, 25],
      [42, 45, 15, 32, 46, 16],

      // 39
      [20, 147, 117, 4, 148, 118],
      [40, 75, 47, 7, 76, 48],
      [43, 54, 24, 22, 55, 25],
      [10, 45, 15, 67, 46, 16],

      // 40
      [19, 148, 118, 6, 149, 119],
      [18, 75, 47, 31, 76, 48],
      [34, 54, 24, 34, 55, 25],
      [20, 45, 15, 61, 46, 16]
    ];

    var qrRSBlock = function(totalCount, dataCount) {
      var _this = {};
      _this.totalCount = totalCount;
      _this.dataCount = dataCount;
      return _this;
    };

    var _this = {};

    var getRsBlockTable = function(typeNumber, errorCorrectionLevel) {

      switch(errorCorrectionLevel) {
      case QRErrorCorrectionLevel.L :
        return RS_BLOCK_TABLE[(typeNumber - 1) * 4 + 0];
      case QRErrorCorrectionLevel.M :
        return RS_BLOCK_TABLE[(typeNumber - 1) * 4 + 1];
      case QRErrorCorrectionLevel.Q :
        return RS_BLOCK_TABLE[(typeNumber - 1) * 4 + 2];
      case QRErrorCorrectionLevel.H :
        return RS_BLOCK_TABLE[(typeNumber - 1) * 4 + 3];
      default :
        return undefined;
      }
    };

    _this.getRSBlocks = function(typeNumber, errorCorrectionLevel) {

      var rsBlock = getRsBlockTable(typeNumber, errorCorrectionLevel);

      if (typeof rsBlock == 'undefined') {
        throw 'bad rs block @ typeNumber:' + typeNumber +
            '/errorCorrectionLevel:' + errorCorrectionLevel;
      }

      var length = rsBlock.length / 3;

      var list = [];

      for (var i = 0; i < length; i += 1) {

        var count = rsBlock[i * 3 + 0];
        var totalCount = rsBlock[i * 3 + 1];
        var dataCount = rsBlock[i * 3 + 2];

        for (var j = 0; j < count; j += 1) {
          list.push(qrRSBlock(totalCount, dataCount) );
        }
      }

      return list;
    };

    return _this;
  }();

  //---------------------------------------------------------------------
  // qrBitBuffer
  //---------------------------------------------------------------------

  var qrBitBuffer = function() {

    var _buffer = [];
    var _length = 0;

    var _this = {};

    _this.getBuffer = function() {
      return _buffer;
    };

    _this.getAt = function(index) {
      var bufIndex = Math.floor(index / 8);
      return ( (_buffer[bufIndex] >>> (7 - index % 8) ) & 1) == 1;
    };

    _this.put = function(num, length) {
      for (var i = 0; i < length; i += 1) {
        _this.putBit( ( (num >>> (length - i - 1) ) & 1) == 1);
      }
    };

    _this.getLengthInBits = function() {
      return _length;
    };

    _this.putBit = function(bit) {

      var bufIndex = Math.floor(_length / 8);
      if (_buffer.length <= bufIndex) {
        _buffer.push(0);
      }

      if (bit) {
        _buffer[bufIndex] |= (0x80 >>> (_length % 8) );
      }

      _length += 1;
    };

    return _this;
  };

  //---------------------------------------------------------------------
  // qrNumber
  //---------------------------------------------------------------------

  var qrNumber = function(data) {

    var _mode = QRMode.MODE_NUMBER;
    var _data = data;

    var _this = {};

    _this.getMode = function() {
      return _mode;
    };

    _this.getLength = function(buffer) {
      return _data.length;
    };

    _this.write = function(buffer) {

      var data = _data;

      var i = 0;

      while (i + 2 < data.length) {
        buffer.put(strToNum(data.substring(i, i + 3) ), 10);
        i += 3;
      }

      if (i < data.length) {
        if (data.length - i == 1) {
          buffer.put(strToNum(data.substring(i, i + 1) ), 4);
        } else if (data.length - i == 2) {
          buffer.put(strToNum(data.substring(i, i + 2) ), 7);
        }
      }
    };

    var strToNum = function(s) {
      var num = 0;
      for (var i = 0; i < s.length; i += 1) {
        num = num * 10 + chatToNum(s.charAt(i) );
      }
      return num;
    };

    var chatToNum = function(c) {
      if ('0' <= c && c <= '9') {
        return c.charCodeAt(0) - '0'.charCodeAt(0);
      }
      throw 'illegal char :' + c;
    };

    return _this;
  };

  //---------------------------------------------------------------------
  // qrAlphaNum
  //---------------------------------------------------------------------

  var qrAlphaNum = function(data) {

    var _mode = QRMode.MODE_ALPHA_NUM;
    var _data = data;

    var _this = {};

    _this.getMode = function() {
      return _mode;
    };

    _this.getLength = function(buffer) {
      return _data.length;
    };

    _this.write = function(buffer) {

      var s = _data;

      var i = 0;

      while (i + 1 < s.length) {
        buffer.put(
          getCode(s.charAt(i) ) * 45 +
          getCode(s.charAt(i + 1) ), 11);
        i += 2;
      }

      if (i < s.length) {
        buffer.put(getCode(s.charAt(i) ), 6);
      }
    };

    var getCode = function(c) {

      if ('0' <= c && c <= '9') {
        return c.charCodeAt(0) - '0'.charCodeAt(0);
      } else if ('A' <= c && c <= 'Z') {
        return c.charCodeAt(0) - 'A'.charCodeAt(0) + 10;
      } else {
        switch (c) {
        case ' ' : return 36;
        case '$' : return 37;
        case '%' : return 38;
        case '*' : return 39;
        case '+' : return 40;
        case '-' : return 41;
        case '.' : return 42;
        case '/' : return 43;
        case ':' : return 44;
        default :
          throw 'illegal char :' + c;
        }
      }
    };

    return _this;
  };

  //---------------------------------------------------------------------
  // qr8BitByte
  //---------------------------------------------------------------------

  var qr8BitByte = function(data) {

    var _mode = QRMode.MODE_8BIT_BYTE;
    var _data = data;
    var _bytes = qrcode.stringToBytes(data);

    var _this = {};

    _this.getMode = function() {
      return _mode;
    };

    _this.getLength = function(buffer) {
      return _bytes.length;
    };

    _this.write = function(buffer) {
      for (var i = 0; i < _bytes.length; i += 1) {
        buffer.put(_bytes[i], 8);
      }
    };

    return _this;
  };

  //---------------------------------------------------------------------
  // qrKanji
  //---------------------------------------------------------------------

  var qrKanji = function(data) {

    var _mode = QRMode.MODE_KANJI;
    var _data = data;

    var stringToBytes = qrcode.stringToBytesFuncs['SJIS'];
    if (!stringToBytes) {
      throw 'sjis not supported.';
    }
    !function(c, code) {
      // self test for sjis support.
      var test = stringToBytes(c);
      if (test.length != 2 || ( (test[0] << 8) | test[1]) != code) {
        throw 'sjis not supported.';
      }
    }('\u53cb', 0x9746);

    var _bytes = stringToBytes(data);

    var _this = {};

    _this.getMode = function() {
      return _mode;
    };

    _this.getLength = function(buffer) {
      return ~~(_bytes.length / 2);
    };

    _this.write = function(buffer) {

      var data = _bytes;

      var i = 0;

      while (i + 1 < data.length) {

        var c = ( (0xff & data[i]) << 8) | (0xff & data[i + 1]);

        if (0x8140 <= c && c <= 0x9FFC) {
          c -= 0x8140;
        } else if (0xE040 <= c && c <= 0xEBBF) {
          c -= 0xC140;
        } else {
          throw 'illegal char at ' + (i + 1) + '/' + c;
        }

        c = ( (c >>> 8) & 0xff) * 0xC0 + (c & 0xff);

        buffer.put(c, 13);

        i += 2;
      }

      if (i < data.length) {
        throw 'illegal char at ' + (i + 1);
      }
    };

    return _this;
  };

  //=====================================================================
  // GIF Support etc.
  //

  //---------------------------------------------------------------------
  // byteArrayOutputStream
  //---------------------------------------------------------------------

  var byteArrayOutputStream = function() {

    var _bytes = [];

    var _this = {};

    _this.writeByte = function(b) {
      _bytes.push(b & 0xff);
    };

    _this.writeShort = function(i) {
      _this.writeByte(i);
      _this.writeByte(i >>> 8);
    };

    _this.writeBytes = function(b, off, len) {
      off = off || 0;
      len = len || b.length;
      for (var i = 0; i < len; i += 1) {
        _this.writeByte(b[i + off]);
      }
    };

    _this.writeString = function(s) {
      for (var i = 0; i < s.length; i += 1) {
        _this.writeByte(s.charCodeAt(i) );
      }
    };

    _this.toByteArray = function() {
      return _bytes;
    };

    _this.toString = function() {
      var s = '';
      s += '[';
      for (var i = 0; i < _bytes.length; i += 1) {
        if (i > 0) {
          s += ',';
        }
        s += _bytes[i];
      }
      s += ']';
      return s;
    };

    return _this;
  };

  //---------------------------------------------------------------------
  // base64EncodeOutputStream
  //---------------------------------------------------------------------

  var base64EncodeOutputStream = function() {

    var _buffer = 0;
    var _buflen = 0;
    var _length = 0;
    var _base64 = '';

    var _this = {};

    var writeEncoded = function(b) {
      _base64 += String.fromCharCode(encode(b & 0x3f) );
    };

    var encode = function(n) {
      if (n < 0) {
        // error.
      } else if (n < 26) {
        return 0x41 + n;
      } else if (n < 52) {
        return 0x61 + (n - 26);
      } else if (n < 62) {
        return 0x30 + (n - 52);
      } else if (n == 62) {
        return 0x2b;
      } else if (n == 63) {
        return 0x2f;
      }
      throw 'n:' + n;
    };

    _this.writeByte = function(n) {

      _buffer = (_buffer << 8) | (n & 0xff);
      _buflen += 8;
      _length += 1;

      while (_buflen >= 6) {
        writeEncoded(_buffer >>> (_buflen - 6) );
        _buflen -= 6;
      }
    };

    _this.flush = function() {

      if (_buflen > 0) {
        writeEncoded(_buffer << (6 - _buflen) );
        _buffer = 0;
        _buflen = 0;
      }

      if (_length % 3 != 0) {
        // padding
        var padlen = 3 - _length % 3;
        for (var i = 0; i < padlen; i += 1) {
          _base64 += '=';
        }
      }
    };

    _this.toString = function() {
      return _base64;
    };

    return _this;
  };

  //---------------------------------------------------------------------
  // base64DecodeInputStream
  //---------------------------------------------------------------------

  var base64DecodeInputStream = function(str) {

    var _str = str;
    var _pos = 0;
    var _buffer = 0;
    var _buflen = 0;

    var _this = {};

    _this.read = function() {

      while (_buflen < 8) {

        if (_pos >= _str.length) {
          if (_buflen == 0) {
            return -1;
          }
          throw 'unexpected end of file./' + _buflen;
        }

        var c = _str.charAt(_pos);
        _pos += 1;

        if (c == '=') {
          _buflen = 0;
          return -1;
        } else if (c.match(/^\s$/) ) {
          // ignore if whitespace.
          continue;
        }

        _buffer = (_buffer << 6) | decode(c.charCodeAt(0) );
        _buflen += 6;
      }

      var n = (_buffer >>> (_buflen - 8) ) & 0xff;
      _buflen -= 8;
      return n;
    };

    var decode = function(c) {
      if (0x41 <= c && c <= 0x5a) {
        return c - 0x41;
      } else if (0x61 <= c && c <= 0x7a) {
        return c - 0x61 + 26;
      } else if (0x30 <= c && c <= 0x39) {
        return c - 0x30 + 52;
      } else if (c == 0x2b) {
        return 62;
      } else if (c == 0x2f) {
        return 63;
      } else {
        throw 'c:' + c;
      }
    };

    return _this;
  };

  //---------------------------------------------------------------------
  // gifImage (B/W)
  //---------------------------------------------------------------------

  var gifImage = function(width, height) {

    var _width = width;
    var _height = height;
    var _data = new Array(width * height);

    var _this = {};

    _this.setPixel = function(x, y, pixel) {
      _data[y * _width + x] = pixel;
    };

    _this.write = function(out) {

      //---------------------------------
      // GIF Signature

      out.writeString('GIF87a');

      //---------------------------------
      // Screen Descriptor

      out.writeShort(_width);
      out.writeShort(_height);

      out.writeByte(0x80); // 2bit
      out.writeByte(0);
      out.writeByte(0);

      //---------------------------------
      // Global Color Map

      // black
      out.writeByte(0x00);
      out.writeByte(0x00);
      out.writeByte(0x00);

      // white
      out.writeByte(0xff);
      out.writeByte(0xff);
      out.writeByte(0xff);

      //---------------------------------
      // Image Descriptor

      out.writeString(',');
      out.writeShort(0);
      out.writeShort(0);
      out.writeShort(_width);
      out.writeShort(_height);
      out.writeByte(0);

      //---------------------------------
      // Local Color Map

      //---------------------------------
      // Raster Data

      var lzwMinCodeSize = 2;
      var raster = getLZWRaster(lzwMinCodeSize);

      out.writeByte(lzwMinCodeSize);

      var offset = 0;

      while (raster.length - offset > 255) {
        out.writeByte(255);
        out.writeBytes(raster, offset, 255);
        offset += 255;
      }

      out.writeByte(raster.length - offset);
      out.writeBytes(raster, offset, raster.length - offset);
      out.writeByte(0x00);

      //---------------------------------
      // GIF Terminator
      out.writeString(';');
    };

    var bitOutputStream = function(out) {

      var _out = out;
      var _bitLength = 0;
      var _bitBuffer = 0;

      var _this = {};

      _this.write = function(data, length) {

        if ( (data >>> length) != 0) {
          throw 'length over';
        }

        while (_bitLength + length >= 8) {
          _out.writeByte(0xff & ( (data << _bitLength) | _bitBuffer) );
          length -= (8 - _bitLength);
          data >>>= (8 - _bitLength);
          _bitBuffer = 0;
          _bitLength = 0;
        }

        _bitBuffer = (data << _bitLength) | _bitBuffer;
        _bitLength = _bitLength + length;
      };

      _this.flush = function() {
        if (_bitLength > 0) {
          _out.writeByte(_bitBuffer);
        }
      };

      return _this;
    };

    var getLZWRaster = function(lzwMinCodeSize) {

      var clearCode = 1 << lzwMinCodeSize;
      var endCode = (1 << lzwMinCodeSize) + 1;
      var bitLength = lzwMinCodeSize + 1;

      // Setup LZWTable
      var table = lzwTable();

      for (var i = 0; i < clearCode; i += 1) {
        table.add(String.fromCharCode(i) );
      }
      table.add(String.fromCharCode(clearCode) );
      table.add(String.fromCharCode(endCode) );

      var byteOut = byteArrayOutputStream();
      var bitOut = bitOutputStream(byteOut);

      // clear code
      bitOut.write(clearCode, bitLength);

      var dataIndex = 0;

      var s = String.fromCharCode(_data[dataIndex]);
      dataIndex += 1;

      while (dataIndex < _data.length) {

        var c = String.fromCharCode(_data[dataIndex]);
        dataIndex += 1;

        if (table.contains(s + c) ) {

          s = s + c;

        } else {

          bitOut.write(table.indexOf(s), bitLength);

          if (table.size() < 0xfff) {

            if (table.size() == (1 << bitLength) ) {
              bitLength += 1;
            }

            table.add(s + c);
          }

          s = c;
        }
      }

      bitOut.write(table.indexOf(s), bitLength);

      // end code
      bitOut.write(endCode, bitLength);

      bitOut.flush();

      return byteOut.toByteArray();
    };

    var lzwTable = function() {

      var _map = {};
      var _size = 0;

      var _this = {};

      _this.add = function(key) {
        if (_this.contains(key) ) {
          throw 'dup key:' + key;
        }
        _map[key] = _size;
        _size += 1;
      };

      _this.size = function() {
        return _size;
      };

      _this.indexOf = function(key) {
        return _map[key];
      };

      _this.contains = function(key) {
        return typeof _map[key] != 'undefined';
      };

      return _this;
    };

    return _this;
  };

  var createDataURL = function(width, height, getPixel) {
    var gif = gifImage(width, height);
    for (var y = 0; y < height; y += 1) {
      for (var x = 0; x < width; x += 1) {
        gif.setPixel(x, y, getPixel(x, y) );
      }
    }

    var b = byteArrayOutputStream();
    gif.write(b);

    var base64 = base64EncodeOutputStream();
    var bytes = b.toByteArray();
    for (var i = 0; i < bytes.length; i += 1) {
      base64.writeByte(bytes[i]);
    }
    base64.flush();

    return 'data:image/gif;base64,' + base64;
  };

  //---------------------------------------------------------------------
  // returns qrcode function.

  return qrcode;
}();

// multibyte support
!function() {

  qrcode.stringToBytesFuncs['UTF-8'] = function(s) {
    // http://stackoverflow.com/questions/18729405/how-to-convert-utf8-string-to-byte-array
    function toUTF8Array(str) {
      var utf8 = [];
      for (var i=0; i < str.length; i++) {
        var charcode = str.charCodeAt(i);
        if (charcode < 0x80) utf8.push(charcode);
        else if (charcode < 0x800) {
          utf8.push(0xc0 | (charcode >> 6),
              0x80 | (charcode & 0x3f));
        }
        else if (charcode < 0xd800 || charcode >= 0xe000) {
          utf8.push(0xe0 | (charcode >> 12),
              0x80 | ((charcode>>6) & 0x3f),
              0x80 | (charcode & 0x3f));
        }
        // surrogate pair
        else {
          i++;
          // UTF-16 encodes 0x10000-0x10FFFF by
          // subtracting 0x10000 and splitting the
          // 20 bits of 0x0-0xFFFFF into two halves
          charcode = 0x10000 + (((charcode & 0x3ff)<<10)
            | (str.charCodeAt(i) & 0x3ff));
          utf8.push(0xf0 | (charcode >>18),
              0x80 | ((charcode>>12) & 0x3f),
              0x80 | ((charcode>>6) & 0x3f),
              0x80 | (charcode & 0x3f));
        }
      }
      return utf8;
    }
    return toUTF8Array(s);
  };

}();

(function (factory) {
  if (typeof define === 'function' && define.amd) {
      define([], factory);
  } else if (typeof exports === 'object') {
      module.exports = factory();
  }
}(function () {
    return qrcode;
}));

return qrcode;})();
/* 番社參拾網站程式
   ・網站設定、協會服務、社區人文、影片、活動：讀取 data/ 資料夾（用 admin.html 管理程式編輯）
   ・文章、照片、留言：訪客打開網頁時，直接向 WordPress.com 讀取
   一般維護不需要改這個檔案。

   網址對照：
     ./                      首頁
     ?service=名稱            服務頁          ?view=services   所有服務
     ?town=名稱               社區頁          ?view=towns      所有社區
     ?view=videos            影片精選
     ?media=名稱              媒體報導        ?view=media      所有媒體報導
     ?p=123 / ?name=代稱      文章（沿用 WordPress 的寫法，舊網站的短網址也能用）
     ?page_id=45 / ?pagename= WordPress 上的頁面
     ?category_name=代稱      分類            ?tag=代稱         標籤
     ?s=關鍵字                搜尋            ?view=search     搜尋頁
     ?view=archives          所有文章         ?view=posts      文章列表（可加 &paged=2）
*/
(function () {
  'use strict';

  var D = {};          // data/ 資料夾裡的網站資料
  var C = {};          // 網站設定（data/site.json）
  var API = '';
  var OLD_HOSTS = [];
  var POST_FIELDS = 'id,date,slug,link,title,content,excerpt,categories,tags,comment_status,jetpack_featured_media_url,sticky';
  var LIST_FIELDS = 'id,date,link,title,excerpt,categories,jetpack_featured_media_url,sticky';
  var view = document.getElementById('view');
  var params = new URLSearchParams(location.search);
  var categoriesP, pagesP;

  /* ---------- 小工具 ---------- */

  function $(s, r) { return (r || document).querySelector(s); }
  function $$(s, r) { return Array.prototype.slice.call((r || document).querySelectorAll(s)); }
  function esc(s) {
    return String(s == null ? '' : s).replace(/[&<>"']/g, function (c) {
      return { '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;', "'": '&#39;' }[c];
    });
  }
  function text(html) {
    var d = document.createElement('div');
    d.innerHTML = String(html || '').replace(/<(script|style)[\s\S]*?<\/\1>/gi, '');
    return (d.textContent || '').replace(/\s+/g, ' ').trim();
  }
  function excerpt(p, max) {
    var t = text(p.excerpt && p.excerpt.rendered || p.content && p.content.rendered || '');
    t = t.replace(/\s*(\[(…|\.\.\.)\]|繼續閱讀.*|Continue reading.*|Read more.*)$/i, '').trim();
    max = max || 110;
    return t.length > max ? t.slice(0, max) + '…' : t;
  }
  function title(p) { return text(p.title && p.title.rendered) || '（無標題）'; }
  function longDate(d) { var a = d.slice(0, 10).split('-'); return a[0] + ' 年 ' + (+a[1]) + ' 月 ' + (+a[2]) + ' 日'; }
  function dotDate(d) { return d.slice(0, 10).replace(/-/g, '.'); }
  function https(u) { return String(u || '').replace(/^http:\/\//i, 'https://').replace(/^\/\//, 'https://'); }
  function sized(u, w) {
    if (!u) return '';
    u = https(u);
    return /wordpress\.com\/|wp\.com\/|\/wp-content\/uploads\//i.test(u) ? u.replace(/\?.*$/, '') + '?w=' + w : u;
  }
  function q(obj) {
    var s = new URLSearchParams();
    Object.keys(obj).forEach(function (k) { if (obj[k] !== undefined && obj[k] !== null && obj[k] !== '') s.set(k, obj[k]); });
    return '?' + s.toString();
  }
  function postUrl(p) { return q({ p: p.id }); }
  function pageUrl(p) { return q({ page_id: p.id }); }
  function catUrl(c) { return isMediaCat(c.name || c.slugText) ? '?view=media' : q({ category_name: c.slugText }); }
  // 媒體報導已經搬到管理程式：WordPress 的「媒體報導」分類改顯示新的媒體報導頁
  function isMediaCat(name) {
    var n = decodeSlug(String(name || ''));
    return shown(D.media).length > 0 && (n === '媒體報導' || n === 'media' || n === '媒体报道');
  }
  function tagUrl(t) { return q({ tag: t.slugText }); }
  function decodeSlug(s) { try { return decodeURIComponent(s); } catch (e) { return s; } }
  function setTitle(t, desc) {
    document.title = t ? t + '｜' + C.name : C.name + '｜' + C.org;
    var m = $('meta[name="description"]');
    if (m && desc) m.setAttribute('content', desc);
  }
  function taipeiToday() { return new Date(Date.now() + 8 * 3600e3).toISOString().slice(0, 10); }

  /* ---------- 讀取 WordPress ---------- */

  var memo = {};
  function api(path, query) {
    var url = API + '/' + path + (query ? q(query) : '');
    if (memo[url]) return memo[url];
    memo[url] = fetchJSON(url, 3).catch(function (e) { delete memo[url]; throw e; });
    return memo[url];
  }
  function fetchJSON(url, tries) {
    var ctrl = window.AbortController ? new AbortController() : null;
    var timer = setTimeout(function () { if (ctrl) ctrl.abort(); }, 15000);
    return fetch(url, ctrl ? { signal: ctrl.signal } : {}).then(function (r) {
      clearTimeout(timer);
      if (r.status === 404 || r.status === 400) { var e = new Error('not found'); e.notFound = true; throw e; }
      if (!r.ok) throw new Error('HTTP ' + r.status);
      return r.json();
    }).catch(function (e) {
      clearTimeout(timer);
      if (e.notFound || tries <= 1) throw e;
      return new Promise(function (ok) { setTimeout(ok, 1200); }).then(function () { return fetchJSON(url, tries - 1); });
    });
  }
  // 分類與頁面清單變動少，存在瀏覽器裡 30 分鐘，換頁時不用重抓
  function cached(key, loader) {
    try {
      var hit = JSON.parse(sessionStorage.getItem(key) || 'null');
      if (hit && Date.now() - hit.t < 30 * 60e3) return Promise.resolve(hit.v);
    } catch (e) { /* 忽略 */ }
    return loader().then(function (v) {
      try { sessionStorage.setItem(key, JSON.stringify({ t: Date.now(), v: v })); } catch (e) { /* 忽略 */ }
      return v;
    });
  }
  function allPages(path, query) {
    var out = [];
    function next(n) {
      return api(path, Object.assign({}, query, { per_page: 100, page: n })).then(function (list) {
        out = out.concat(list);
        return list.length === 100 && n < 30 ? next(n + 1) : out;
      }).catch(function (e) { if (e.notFound && n > 1) return out; throw e; });
    }
    return next(1);
  }
  function startWordPress() {
  categoriesP = cached('fs30-cats-' + C.wordpressSite, function () {
    return allPages('categories', { _fields: 'id,name,slug,count,parent' }).then(function (list) {
      return list.map(function (c) { return { id: c.id, name: text(c.name), slug: c.slug, slugText: decodeSlug(c.slug), count: c.count }; });
    });
  });
  pagesP = cached('fs30-pages-' + C.wordpressSite, function () {
    return allPages('pages', { _fields: 'id,slug,title,parent,menu_order,link' }).then(function (list) {
      return list.map(function (p) { return { id: p.id, slug: p.slug, title: title(p), parent: p.parent, order: p.menu_order, link: p.link }; });
    });
  });
  categoriesP.catch(function () {});
  pagesP.catch(function () {});
  }
  function catsById(ids, cats) {
    return (ids || []).map(function (id) { return cats.filter(function (c) { return c.id === id; })[0]; })
      .filter(function (c) { return c && c.slug !== 'uncategorized'; });
  }

  /* ---------- 整理 WordPress 內文 ---------- */

  var REMOVE = 'script,style,noscript,object,embed,form,.sharedaddy,.jp-relatedposts,#jp-post-flair,.wpcnt,.wordads-ad-wrapper,.jetpack-likes-widget-wrapper,.wp-block-jetpack-subscriptions';
  var IMAGE_FILE = /\.(jpe?g|png|gif|webp|avif)(\?|$)/i;

  // 連到舊網站的連結，改成新網站的網址
  function localHref(href) {
    var u;
    try { u = new URL(href, 'https://' + C.wordpressSite + '/'); } catch (e) { return null; }
    if (OLD_HOSTS.indexOf(u.hostname.toLowerCase()) < 0) return null;
    if (u.searchParams.get('p')) return q({ p: u.searchParams.get('p') });
    if (u.searchParams.get('page_id')) return q({ page_id: u.searchParams.get('page_id') });
    var seg = u.pathname.split('/').filter(Boolean);
    if (!seg.length) return './' + u.hash;
    if (/^(wp-admin|wp-login\.php|wp-content|feed)$/.test(seg[0]) || seg.indexOf('attachment') >= 0 || seg.indexOf('feed') >= 0) return null;
    if (seg[0] === 'category') return q({ category_name: decodeSlug(seg[seg.length - 1]) });
    if (seg[0] === 'tag') return q({ tag: decodeSlug(seg[1] || '') });
    if (/^\d{4}$/.test(seg[0])) return seg.length >= 4 ? q({ name: decodeSlug(seg[3]) }) + u.hash : q({ view: 'archives' });
    return q({ pagename: decodeSlug(seg[seg.length - 1]) }) + u.hash;
  }

  function clean(html, isComment) {
    var t = document.createElement('template');
    t.innerHTML = html || '';
    var root = t.content;
    $$(REMOVE, root).forEach(function (el) { el.remove(); });
    $$('*', root).forEach(function (el) {
      Array.prototype.slice.call(el.attributes).forEach(function (a) {
        if (/^on/i.test(a.name) || /^\s*javascript:/i.test(a.value)) el.removeAttribute(a.name);
      });
    });
    $$('a[href]', root).forEach(function (a) {
      var href = a.getAttribute('href');
      var local = localHref(href);
      if (local) { a.setAttribute('href', local); a.removeAttribute('target'); }
      else if (/^(https?:)?\/\//i.test(href)) {
        a.setAttribute('href', https(href));
        if (!IMAGE_FILE.test(href)) { a.setAttribute('target', '_blank'); a.setAttribute('rel', 'noopener'); }
      }
      if (isComment) a.setAttribute('rel', 'nofollow ugc noopener');
    });
    $$('img', root).forEach(function (img, i) {
      if (img.getAttribute('src')) img.setAttribute('src', https(img.getAttribute('src')));
      if (img.getAttribute('srcset')) img.setAttribute('srcset', img.getAttribute('srcset').replace(/http:\/\//gi, 'https://'));
      img.setAttribute('loading', i === 0 && !isComment ? 'eager' : 'lazy');
      img.setAttribute('decoding', 'async');
      img.setAttribute('referrerpolicy', 'no-referrer');
      if (!img.hasAttribute('alt')) img.setAttribute('alt', '');
      var a = img.parentElement && img.parentElement.tagName === 'A' ? img.parentElement : null;
      var linked = a && a.getAttribute('href');
      if (!isComment && (!linked || IMAGE_FILE.test(linked))) {
        img.setAttribute('data-full', sized(img.getAttribute('data-orig-file') || linked || img.getAttribute('src'), 2000));
      }
    });
    $$('iframe', root).forEach(function (f) {
      var src = https(f.getAttribute('src') || '');
      if (!/^https:\/\//.test(src)) { f.remove(); return; }
      f.setAttribute('src', src);
      f.setAttribute('loading', 'lazy');
      f.removeAttribute('width'); f.removeAttribute('height');
      if (/youtube|youtu\.be|vimeo|facebook\.com\/plugins\/video/i.test(src) && !f.parentElement.classList.contains('video-frame')) {
        var box = document.createElement('div');
        box.className = 'video-frame';
        f.parentNode.insertBefore(box, f);
        box.appendChild(f);
      }
    });
    $$('table', root).forEach(function (tb) {
      var box = document.createElement('div');
      box.className = 'table-scroll';
      tb.parentNode.insertBefore(box, tb);
      box.appendChild(tb);
    });
    $$('.tiled-gallery [style], .tiled-gallery img', root).forEach(function (el) {
      el.removeAttribute('style');
      if (el.tagName === 'IMG') { el.removeAttribute('width'); el.removeAttribute('height'); }
    });
    var d = document.createElement('div');
    d.appendChild(root);
    return d.innerHTML;
  }

  function imageKey(u) {
    return String(u || '').replace(/\?.*$/, '').split('/').pop().replace(/-(\d+x\d+|scaled|e\d{10,})(?=\.)/g, '').toLowerCase();
  }

  /* ---------- 共用畫面 ---------- */

  function loading() { view.innerHTML = '<div class="wrap loading">讀取中…</div>'; }

  function showError(err, what) {
    var notFound = err && err.notFound;
    setTitle(notFound ? '找不到這個頁面' : '暫時讀不到內容');
    view.innerHTML = '<div class="wrap err"><h1>' + (notFound ? '找不到這個頁面' : '暫時讀不到內容') + '</h1>' +
      (notFound
        ? '<p>網址可能打錯，或' + (what || '文章') + '已經移除。可以 <a href="?view=search">' + esc(ui('search','搜尋')) + '</a> 找找看，或看 <a href="?view=archives">' + esc(ui('footerPosts','所有文章')) + '</a>。</p>'
        : '<p>文章存放在 WordPress，現在連不上。請稍後重新整理，或直接到 <a href="https://' + esc(C.wordpressSite) + '/">原網站</a> 閱讀。</p>') +
      '<p><a class="more" href="./">回到首頁</a></p></div>';
    if (err && !notFound && window.console) console.error(err);
  }

  function thumbHtml(p, i) {
    var src = sized(p.jetpack_featured_media_url || firstImage(p), 480);
    return '<div class="ph thumb t' + (i % 3 + 1) + '" aria-hidden="true">' +
      (src ? '<img data-ph="1" src="' + esc(src) + '" alt="" loading="lazy" decoding="async" referrerpolicy="no-referrer">' : '') + '</div>';
  }
  function firstImage(p) {
    var m = (p.content && p.content.rendered || '').match(/<img[^>]+src="([^"]+)"/);
    return m ? m[1] : '';
  }

  // 已經匯入管理程式的 WordPress 文章（媒體報導），不在文章列表重複出現
  function hideImported(posts) {
    var ids = {};
    (D.media || []).concat(D.shanhaiji || []).forEach(function (x) { if (x.wpId) ids[x.wpId] = 1; });
    return posts.filter(function (p) { return !ids[p.id]; });
  }

  function listHtml(posts,cats,offset) {
    posts=hideImported(posts);
    if(!posts.length) return '<p class="c-empty">'+esc(ui('postEmpty','這裡目前沒有文章。'))+'</p>';
    return posts.map(function(p,i) {
      var c=catsById(p.categories,cats)[0];
      return '<article class="post culture-post">'+thumbHtml(p,i+(offset||0))+'<div class="post-content"><div class="p-date"><time datetime="'+esc(p.date)+'">'+esc(dotDate(p.date))+'</time>'+
        (c?'<span class="post-category">'+esc(c.name)+'</span>':'')+'</div><h3><a href="'+postUrl(p)+'">'+esc(title(p))+'</a></h3><p class="post-summary">'+esc(excerpt(p))+'</p>'+
        '<a class="more post-read" href="'+postUrl(p)+'">'+esc(ui('readArticle','閱讀全文'))+'</a></div></article>';
    }).join('');
  }
  function filterHtml(cats, currentId) {
    var list = C.featuredCategories.map(function (n) { return cats.filter(function (c) { return c.name === n && c.count > 0; })[0]; }).filter(Boolean);
    return '<nav class="filters" aria-label="依分類瀏覽"><a href="?view=archives"' + (!currentId ? ' aria-current="page"' : '') + '>全部</a>' +
      list.map(function (c) { return '<a href="' + catUrl(c) + '"' + (c.id === currentId ? ' aria-current="page"' : '') + '>' + esc(c.name) + '</a>'; }).join('') + '</nav>';
  }

  function pagerHtml(n, hasMore, extra) {
    if (n <= 1 && !hasMore) return '';
    return '<nav class="pager" aria-label="分頁">' +
      (n > 1 ? '<a href="' + q(Object.assign({}, extra, { paged: n > 2 ? n - 1 : '' })) + '" rel="prev">上一頁</a>' : '') +
      '<span aria-current="page">第 ' + n + ' 頁</span>' +
      (hasMore ? '<a href="' + q(Object.assign({}, extra, { paged: n + 1 })) + '" rel="next">下一頁</a>' : '') + '</nav>';
  }

  /* ---------- 網站資料 ---------- */

  function shown(list) { return (list || []).filter(function (x) { return x && !x.hidden && x.title; }); }
  function serviceUrl(x) { return q({ service: x.slug || x.title }); }
  function townUrl(x) { return q({ town: x.slug || x.title }); }
  function findBy(list, slug) {
    return shown(list).filter(function (x) { return (x.slug || x.title) === slug || x.title === slug; })[0];
  }
  // 照片網址：管理程式上傳的是 uploads/ 開頭的相對路徑；WordPress 的照片用 ?w= 縮圖
  function img(u, w) {
    if (!u) return '';
    if (/^uploads\//.test(u)) return u;
    return ContentSettings.imagePath(u);
  }
  // LINE's documented chat scheme supports mobile, not Windows/macOS clients.
  // Desktop contact stays on this site, with a local QR and explicit copy actions.
  function bindDesktopLineContact() {
    function mobile() {return /Android|iPhone|iPad|iPod/i.test(navigator.userAgent)||(/Macintosh/i.test(navigator.userAgent)&&navigator.maxTouchPoints>1);}
    function contact(raw) {
      var url;try{url=new URL(raw,location.href);}catch(e){return null;}
      if(url.protocol!=='https:')return null;
      var id='',message='',match;
      if(/^(www\.)?line\.me$/i.test(url.hostname)) {
        match=url.pathname.match(/^\/(?:R\/)?(?:oaMessage|ti\/p)\/([^/]+)/i);
        if(!match)return null;
        try{id=decodeURIComponent(match[1]);if(/\/oaMessage\//i.test(url.pathname))message=decodeURIComponent(url.search.slice(1));}catch(e){return null;}
        if(!/^@?[A-Za-z0-9._-]{1,64}$/.test(id))return null;
        if(id.charAt(0)!=='@')id='@'+id;
        return {id:id,message:message,profile:'https://line.me/R/ti/p/'+encodeURIComponent(id)};
      }
      if(url.hostname==='lin.ee'&&String((C.visit||{}).line||'').trim().replace(/\/$/,'')===url.href.replace(/\/$/,''))return {id:'',message:'',profile:url.href};
      return null;
    }
    var dialog,opener;
    function close(){dialog.close();if(opener&&opener.isConnected)opener.focus();}
    function copy(text,status) {
      function fallback(){var field=dialog.querySelector('[data-line-message]');field.closest('label').hidden=false;field.closest('label').firstChild.textContent='可複製文字';field.hidden=false;field.value=text;field.focus();field.select();var ok=false;try{ok=document.execCommand('copy');}catch(e){}status.textContent=ok?'已複製。':'請按 Ctrl+C（Mac 為 ⌘C）複製選取文字。';}
      if(navigator.clipboard&&navigator.clipboard.writeText)navigator.clipboard.writeText(text).then(function(){status.textContent='已複製。';},fallback);else fallback();
    }
    function open(info,button) {
      opener=button;
      if(!dialog){dialog=document.createElement('dialog');dialog.className='line-contact-dialog';dialog.setAttribute('aria-labelledby','lineContactTitle');document.body.appendChild(dialog);dialog.addEventListener('click',function(e){if(e.target===dialog)close();});dialog.addEventListener('cancel',function(e){e.preventDefault();close();});}
      dialog.innerHTML='<button type="button" class="line-contact-close" aria-label="關閉 LINE 客服視窗">×</button><h2 id="lineContactTitle">LINE 官方客服</h2><p>用手機 LINE 掃描 QR Code，加入或開啟客服對話。</p><div class="line-contact-qr" role="img" aria-label="LINE 官方客服 QR Code"></div>'+(info.id?'<p class="line-contact-id">官方帳號 <strong>'+esc(info.id)+'</strong></p>':'')+'<div class="line-contact-actions">'+(info.id?'<button type="button" class="btn ghost" data-line-copy-id>複製客服 ID</button>':'')+(info.message?'<button type="button" class="btn" data-line-copy-message>複製詢問內容</button>':'')+'</div>'+(info.message?'<p>若已在電腦 LINE 加入客服，可開啟對話後貼上詢問內容。</p>':'')+'<label class="line-contact-message-label"'+(info.message?'':' hidden')+'>詢問內容<textarea data-line-message readonly rows="4"'+(info.message?'':' hidden')+'></textarea></label><p class="line-contact-status" role="status" aria-live="polite"></p><p><a class="more" href="'+esc(info.profile)+'" target="_blank" rel="noopener">另開官方帳號頁</a></p>';
      var status=dialog.querySelector('.line-contact-status'),field=dialog.querySelector('[data-line-message]');field.value=info.message;
      var qr=HS30LineQR(0,'M');qr.addData(info.profile);qr.make();dialog.querySelector('.line-contact-qr').innerHTML=qr.createSvgTag({cellSize:6,margin:24,scalable:true});
      dialog.querySelector('.line-contact-close').onclick=close;
      var idButton=dialog.querySelector('[data-line-copy-id]');if(idButton)idButton.onclick=function(){copy(info.id,status);};
      var messageButton=dialog.querySelector('[data-line-copy-message]');if(messageButton)messageButton.onclick=function(){copy(info.message,status);};
      if(!dialog.open)dialog.showModal();dialog.querySelector('.line-contact-close').focus();
    }
    document.addEventListener('click',function(e){
      if(mobile()||e.defaultPrevented||e.button!==0)return;
      var link=e.target.closest&&e.target.closest('a[href]');if(!link||link.closest('.line-contact-dialog'))return;
      var info=contact(link.getAttribute('href'));if(!info)return;
      e.preventDefault();e.stopPropagation();open(info,link);
    },true);
  }

  function lineHref(svc) {
    var value = String(C.visit.line || '').trim();
    var href=value ? (/^https?:\/\//i.test(value) ? value : 'https://line.me/R/oaMessage/' + encodeURIComponent(value)) : '';
    return svc && /^https:\/\/line\.me\/R\/oaMessage\//i.test(href) ? href.split('?')[0].replace(/\/$/,'')+'/?'+encodeURIComponent(bookingMessage(svc)) : href;
  }
  function bookingUrl(svc) {
    return ContentSettings.linkPath(String((svc && svc.bookingUrl) || C.visit.bookingUrl || '').replace(/\{service\}/g,encodeURIComponent(svc ? svc.title : '團體到訪')));
  }
  function sectionConf(key) {
    return (C.sections || []).filter(function (x) { return x.key === key; })[0] || { key: key, title: '', intro: '' };
  }

  // 選單項目的網址
  function navHref(item) {
    switch (item.type) {
      case 'auto-services': return '?view=services';
      case 'auto-towns': return '?view=towns';
      case 'service': var sv = findBy(D.services, item.target); return sv ? serviceUrl(sv) : '?view=services';
      case 'town': var tw = findBy(D.towns, item.target); return tw ? townUrl(tw) : '?view=towns';
      case 'videos': return '?view=videos';
      case 'media': return '?view=media';
      case 'posts': return '?view=archives';
      case 'visit': return './#visit';
      case 'search': return '?view=search';
      case 'category': return isMediaCat(item.target) ? '?view=media' : q({ category_name: item.target || '' });
      case 'url': return item.target || './';
      default: return './';
    }
  }
  function navChildren(item) {
    if (item.type === 'auto-services') return shown(D.services).map(function (x) { return { label: x.title, href: serviceUrl(x) }; });
    if (item.type === 'auto-towns') return shown(D.towns).map(function (x) { return { label: x.title, href: townUrl(x) }; });
    if (item.type === 'menu') return (item.children || []).map(function (c) { return { label: c.label, href: navHref(c) }; });
    return [];
  }

  /* ---------- 頁首、頁尾 ---------- */

  function ui(key, fallback) {
    return C.ui && C.ui[key] != null ? String(C.ui[key]) : fallback;
  }
  function template(value, vars) {
    return String(value || '').replace(/\{(\w+)\}/g, function (all, key) { return vars[key] == null ? all : String(vars[key]); });
  }
  function counterCode() {
    var value = String(C.goatcounter || '').trim().toLowerCase();
    var match = value.match(/^(?:https?:\/\/)?([a-z0-9](?:[a-z0-9-]{0,61}[a-z0-9])?)(?:\.goatcounter\.com\/?)?$/);
    return match ? match[1] : '';
  }
  function trackingAllowed() {
    var hosts = (C.statistics || {}).allowedHosts || [];
    return !hosts.length || hosts.some(function(host) {
      return String(host).trim().toLowerCase() === location.hostname.toLowerCase();
    });
  }
  function parseCounterValue(value) {
    if (typeof value === 'string') {
      if (!/^\d[\d,\s]*$/.test(value.trim())) return null;
      value = Number(value.replace(/[,\s]/g, ''));
    }
    return Number.isSafeInteger(value) && value >= 0 ? value : null;
  }
  function renderHistoricalStats() {
    var box = $('#siteStats'), S = C.statistics || {}, base = parseCounterValue(S.historicalViews);
    if (!box) return Promise.resolve();
    box.hidden = !S.show || base === null;
    if (box.hidden) { box.innerHTML = ''; return Promise.resolve(); }
    function draw(live) {
      var combined = live !== null, total = combined ? base + live : base;
      if (!Number.isSafeInteger(total)) { combined = false; total = base; }
      var label = combined ? S.label : S.historicalLabel || '舊站累計';
      box.innerHTML = '<span>' + esc([label, total.toLocaleString('zh-TW'), S.unit].filter(Boolean).join(' ')) + '</span>' +
        (combined && S.breakdown ? '<small style="display:block">' + esc(template(S.breakdown,{base:base.toLocaleString('zh-TW'),live:live.toLocaleString('zh-TW')})) + '</small>' : '') +
        (S.mode === 'combined' && counterCode() && !trackingAllowed() ? '<small class="stats-host-note" style="display:block">' + esc(S.inactiveHostText == null ? '此網域不記錄點閱；正式網站開放後開始計數。' : S.inactiveHostText) + '</small>' : '');
    }
    draw(null);
    var code = counterCode();
    if (S.mode !== 'combined' || !code) return Promise.resolve();
    return fetch('https://' + code + '.goatcounter.com/counter/TOTAL.json').then(function(response) {
      if (!response.ok) throw new Error('counter unavailable'); return response.json();
    }).then(function(data) {
      var live = parseCounterValue(data.count); if (live === null) throw new Error('invalid counter'); draw(live);
    }).catch(function() { draw(null); });
  }
  function configureBrandAndHouse() {
    var B = C.brand || {}, H = C.hero || {}, F = C.footer || {};
    var logo = ContentSettings.imagePath(B.logo), icon = ContentSettings.imagePath(B.icon);
    $('#brand').classList.toggle('brand-with-logo', !!logo);
    if (logo) $('#brand').innerHTML = '<img class="brand-logo" src="' + esc(logo) + '" alt="' + esc(B.logoAlt || '') + '" width="56" height="50" loading="eager" decoding="async"><span class="brand-text">' + esc(C.org) + '</span>';
    var siteIcon = $('#siteIcon');
    if (siteIcon) { if (icon) { siteIcon.href = icon; siteIcon.removeAttribute('type'); } else siteIcon.removeAttribute('href'); }
    var entry = $('.heritage-entry'), label = $('.heritage-entry-label'), picture = $('.heritage-image');
    if (picture) picture.alt = H.illustrationAlt || '';
    if (entry) {
      var href = ContentSettings.linkPath(H.entryHref);
      if (href) entry.setAttribute('href', href); else entry.removeAttribute('href');
      entry.setAttribute('aria-label', H.entryText || H.illustrationAlt || C.name);
    }
    if (label) {
      label.textContent = H.entryText || '';
      label.hidden = !H.entryText;
      var storyHref = ContentSettings.linkPath(H.entryHref);
      if (storyHref) label.setAttribute('href', storyHref); else label.removeAttribute('href');
    }
    var note = $('.heritage-place-note');
    if (note) { note.textContent = H.note || ''; note.hidden = !H.note; }
    [['.heritage-lintel', Array.from(H.lintel || '').reverse().join('')], ['.heritage-plaque--left', H.leftPlaque], ['.heritage-plaque--right', H.rightPlaque], ['.heritage-year--left', H.leftYear], ['.heritage-year--right', H.rightYear]].forEach(function (pair) {
      var el = $(pair[0]); if (el) el.textContent = pair[1] || '';
    });
    $('#subscribeTitle').textContent = F.subscribeTitle || '';
    $('#contactTitle').textContent = F.contactTitle || '';
    $('#copy').textContent = template(F.copyright, {year:new Date().getFullYear(),org:C.org,name:C.name});
    $('[data-lb="prev"]').textContent = ui('previousImage', '上一張');
    $('[data-lb="next"]').textContent = ui('nextImage', '下一張');
    $('[data-lb="close"]').textContent = ui('close', '關閉');
  }

  function renderChrome() {
    $('#brand').textContent = C.org;
    $('#heroName').textContent = C.name;
    $('#heroTag').textContent = C.tagline;
    $('#menuBtn').innerHTML = '<span class="menu-bars" aria-hidden="true"><span></span><span></span><span></span></span>';
    $('#menuBtn').setAttribute('aria-label', ui('menu','選單'));
    $('.skip').textContent = ui('skip','跳到主要內容');
    // 首頁圖片都由 data/site.json 設定，沿用 ADMIN 的 uploads 照片庫。
    var houseImage = $('.heritage-image'), houseEntry = $('.heritage-entry'), H = C.hero || {};
    if (houseImage) {
      houseImage.hidden = !H.illustration;
      if (H.illustration) houseImage.src = img(H.illustration, 1600);
      if (houseEntry) houseEntry.hidden = !H.illustration;
      $$('.heritage-lintel,.heritage-plaque,.heritage-year').forEach(function (el) {
        el.hidden = !H.illustration || H.illustrationLabels === false;
      });
    }

    (C.visuals.placeholders || []).forEach(function(x,i){var path=img(x.image);document.documentElement.style.setProperty('--placeholder-image-'+(i+1),path?'url("'+path+'")':'none');});
    var houseLight = $('.heritage-light');
    if (houseLight) {
      var source = img(H.illustration, 1600);
      houseLight.hidden = !source || H.lightEffects === false;
      function lightValue(value, fallback, min, max) {
        var n = Number(value == null || value === '' ? fallback : value);
        return Number.isFinite(n) ? Math.min(max, Math.max(min, n)) : fallback;
      }
      houseLight.style.setProperty('--house-light-image', source ? 'url("' + source.replace(/"/g, '%22') + '")' : 'none');
      houseLight.style.setProperty('--house-sun-strength', lightValue(H.sunStrength,170,0,300) / 100);
      houseLight.style.setProperty('--house-ray-strength', lightValue(H.rayStrength,80,0,200) / 100);
      houseLight.style.setProperty('--house-sun-duration', lightValue(H.sunDuration,11,1,120) + 's');
      houseLight.style.setProperty('--house-ray-duration', lightValue(H.rayDuration,7,1,120) + 's');
    }
    configureBrandAndHouse();
    renderHistoricalStats();
    var V = C.visit;
    $('#contact').innerHTML = '<p>' + esc(V.address) + '</p><div class="foot-links">' +
      (V.phone ? '<a href="tel:' + esc(V.phone.replace(/[^\d+]/g, '')) + '">' + esc(V.phone) + '</a>' : '') +
      (V.email ? '<a href="mailto:' + esc(V.email) + '">' + esc(V.email) + '</a>' : '') +
      (V.line ? '<a href="' + esc(lineHref()) + '">' + esc(ui('line','LINE 官方客服')) + (V.line.charAt(0) === '@' ? ' ' + esc(V.line) : '') + '</a>' : '') +
      (V.facebookUrl ? '<a href="' + esc(V.facebookUrl) + '" target="_blank" rel="noopener">' + esc(ui('footerFacebook','Facebook')) + '</a>' : '') +
      (V.bookingUrl ? '<a href="' + esc(V.bookingUrl) + '" target="_blank" rel="noopener">' + esc(ui('footerBooking','預約導覽')) + '</a>' : '') +
      '<a href="?view=services">' + esc(ui('footerServices','服務項目')) + '</a><a href="?view=archives">' + esc(ui('footerPosts','所有文章')) + '</a><a href="?view=search">' + esc(ui('search','搜尋')) + '</a></div>';

    var here = location.search || './';
    $('#nav').innerHTML = (C.nav || []).map(function (n) {
      var kids = navChildren(n);
      if (kids.length) {
        var top = n.type === 'menu' ? '' : navHref(n);
        return '<details><summary>' + esc(n.label) + '</summary><div class="sub">' +
          (top ? '<a href="' + esc(top) + '">' + esc(n.label) + '總覽</a>' : '') +
          kids.map(function (c) { return '<a href="' + esc(c.href) + '">' + esc(c.label) + '</a>'; }).join('') + '</div></details>';
      }
      var h = navHref(n);
      return '<a href="' + esc(h) + '"' + (h === here ? ' aria-current="page"' : '') + '>' + esc(n.label) + '</a>';
    }).join('');

    // 古厝插畫下方：地址、開放時間與開放狀態
    var hs = $('#heroSide');
    if (hs) {
      var fmt0 = function (t) { return String(t || '').replace(/^0/, ''); };
      hs.innerHTML = '<p class="hero-addr">' + esc(V.address) + '</p>' +
        '<p class="hero-hours">' + esc(V.openText) + '　' + fmt0(V.open) + '–' + fmt0(V.close) + '</p>' +
        '<p class="status" data-status aria-live="polite"><span class="dot"></span><span class="status-text"></span></p>';
    }

    // 手機版選單：展開的面板從頁首下方開始
    var setTop = function () { document.documentElement.style.setProperty('--topbar-h', $('.topbar').offsetHeight + 'px'); };
    setTop();
    window.addEventListener('resize', setTop);

    // 手機版選單按鈕
    var mb = $('#menuBtn'), nav = $('#nav');
    if (mb && !mb._bound) {
      mb._bound = true;
      var setOpen = function (o) {
        document.body.classList.toggle('menu-open', o);
        mb.setAttribute('aria-expanded', o ? 'true' : 'false');
        mb.setAttribute('aria-label', o ? ui('close', '關閉') : ui('menu', '選單'));
      };
      mb.addEventListener('click', function () { setOpen(!document.body.classList.contains('menu-open')); });
      nav.addEventListener('click', function (e) { if (e.target.closest('a')) setOpen(false); });
      document.addEventListener('keydown', function (e) { if (e.key === 'Escape') setOpen(false); });
    }

    // 封面按鈕
    var hb = $('#heroBtns');
    if (hb) {
      var H = C.hero || {};
      var book = ContentSettings.linkPath(H.secondaryHref || bookingUrl());
      var primary = ContentSettings.linkPath(H.primaryHref || '?view=services');
      hb.innerHTML = '<a class="btn" href="' + esc(primary) + '">' + esc(H.primaryText || '看服務項目') + '</a>' +
        '<a class="btn ghost-dark" href="' + esc(book || './#visit') + '"' + (book ? ' target="_blank" rel="noopener"' : '') + '>' + esc(H.secondaryText || '預約導覽') + '</a>';
    }

    // Email 訂閱：使用 WordPress.com 原本的訂閱服務，現有訂閱者不用搬
    var blogId = C.wordpressBlogId
      ? Promise.resolve(String(C.wordpressBlogId))
      : cached('fs30-blogid', function () {
          return fetchJSON('https://public-api.wordpress.com/rest/v1.1/sites/' + C.wordpressSite + '?fields=ID', 2).then(function (d) { return String(d.ID || ''); });
        });
    blogId.then(function (id) {
      if (!id) throw new Error('no id');
      $('#subscribe').innerHTML = '<p>' + esc([C.footer.subscribeIntro, C.footer.subscribeHint].filter(Boolean).join(' ')) + '</p>' +
        '<form class="sub-form" action="https://subscribe.wordpress.com" method="post" accept-charset="utf-8" target="_blank">' +
        '<input type="hidden" name="action" value="subscribe"><input type="hidden" name="blog_id" value="' + esc(id) + '">' +
        '<input type="hidden" name="source" value="' + esc(location.origin + location.pathname) + '"><input type="hidden" name="sub-type" value="widget">' +
        '<label class="sr" for="subEmail">Email</label><input id="subEmail" type="email" name="email" required placeholder="' + esc(C.footer.subscribePlaceholder || '') + '" autocomplete="email">' +
        '<button class="btn" type="submit">' + esc(C.footer.subscribeButton || '') + '</button></form>';
    }).catch(function () {
      $('#subscribe').innerHTML = '<p><a class="more" href="https://' + esc(C.wordpressSite) + '/" target="_blank" rel="noopener">' + esc(ui('subscriptionFallback','到 WordPress 訂閱 Email 通知')) + '</a></p>';
    });

    var code = counterCode();
    if (code && trackingAllowed()) {
      var s = document.createElement('script');
      s.async = true; s.src = 'https://gc.zgo.at/count.js';
      s.setAttribute('data-goatcounter', 'https://' + code + '.goatcounter.com/count');
      s.setAttribute('data-goatcounter-settings', JSON.stringify({no_session: !C.statistics || C.statistics.countEveryPageview !== false}));
      document.body.appendChild(s);
    }
  }

  /* ---------- 首頁 ---------- */

  function secHead(key, id, fallback) {
    var c = sectionConf(key);
    return '<h2 class="sec-h" id="' + id + '">' + esc(c.title || fallback) + '</h2>' + (c.intro ? '<p class="sec-intro">' + esc(c.intro) + '</p>' : '');
  }

  // 服務卡片：直式大照片 + 名稱 + 一句話 + 服務資訊標籤
  function svcCard(x,i) { return svcRow(x,i); }
  function servicesHtml() {
    var list = shown(D.services);
    if (!list.length) return '';
    return '<div class="svc-rows culture-service-grid">' + list.map(svcRow).join('') + '</div>';
  }
  function factsOf(x) {
    return [[ui('audience', '適合對象'), x.audience], [ui('duration', '所需時間'), x.duration], [ui('capacity', '人數'), x.capacity], [ui('fee', '費用'), x.fee]].filter(function (r) { return r[1]; });
  }
  // 服務列：照片佔大面積，文字只放名稱、一句話、服務資訊
function svcRow(x, i) {
    var src=img(x.cover,900), href=serviceUrl(x), f=factsOf(x);
    return '<article class="svc-row culture-service-card">'+(x.category?'<span class="service-category">'+esc(x.category)+'</span>':'')+'<a class="svc-row-photo ph t'+(i%3+1)+'" href="'+esc(href)+'" tabindex="-1" aria-hidden="true">'+
      (src?'<img data-ph="1" src="'+esc(src)+'" alt="'+esc(x.coverAlt||'')+'" loading="lazy" decoding="async">':'')+'</a>'+
      '<div class="svc-row-text">'+
      '<h3><a href="'+esc(href)+'">'+esc(x.title)+'</a></h3>'+(x.summary?'<p class="service-summary">'+esc(x.summary)+'</p>':'')+
      (f.length?'<dl class="mini-facts">'+f.slice(0,2).map(function(r){return '<div><dt>'+esc(r[0])+'</dt><dd>'+esc(r[1])+'</dd></div>';}).join('')+'</dl>':'')+
      '<div class="service-card-actions"><a class="btn" href="'+esc(bookingEntry(x))+'">'+esc(x.bookingText||ui('serviceBooking','預約與詢問'))+'</a></div></div></article>';
  }

  function cardHtml(x, href, i) {
    var src = img(x.cover, 800);
    return '<a class="card" href="' + href + '"><div class="ph t' + (i % 3 + 1) + '" aria-hidden="true">' +
      (src ? '<img data-ph="1" src="' + esc(src) + '" alt="' + esc(x.coverAlt || '') + '" loading="lazy" decoding="async" referrerpolicy="no-referrer">' : '') +
      '</div><h3>' + esc(x.title) + '</h3>' + (x.summary ? '<p>' + esc(x.summary) + '</p>' : '') + '</a>';
  }
  function townsHtml() {
    var list = shown(D.towns);
    if (!list.length) return '';
    return '<div class="cards cards-sm">' + list.map(function (x, i) { return cardHtml(x, townUrl(x), i + 1); }).join('') + '</div>';
  }

  function ytId(u) {
    var m = String(u || '').match(/(?:youtu\.be\/|v=|embed\/|shorts\/|live\/)([\w-]{11})/);
    return m ? m[1] : '';
  }
  function videoCard(v) {
    var id = ytId(v.url); if (!id) return '';
    var cover = img(v.cover || (C.visuals || {}).videoFallback, 800), play = img((C.visuals || {}).playIcon, 100);
    return '<figure class="vid"><button type="button" class="vid-play" data-yt="' + id + '" aria-label="' + esc(template(ui('playVideo', '播放：{title}'), {title:v.title})) + '">' +
      (cover ? '<img src="' + esc(cover) + '" alt="' + esc(v.coverAlt || '') + '" loading="lazy" decoding="async">' : '') +
      (play ? '<img class="custom-play-icon" src="' + esc(play) + '" alt="">' : '<span class="vid-btn" aria-hidden="true"></span>') + '</button>' +
      '<figcaption><strong>' + esc(v.title) + '</strong>' + (v.description ? '<span>' + esc(v.description) + '</span>' : '') + '</figcaption></figure>';
  }

  function bookingActs(svc, compact) {
    var V = C.visit, book = bookingUrl(svc);
    return (svc ? '<a class="btn" href="' + esc(bookingEntry(svc)) + '">' + esc(ui('serviceBooking','預約與詢問')) + '</a>' : '') + (book ? '<a class="btn" href="' + esc(book) + '" target="_blank" rel="noopener">' + esc(ui('bookOnline', '線上預約')) + '</a>' : '') +
      (V.phone ? '<a class="btn ' + (book ? 'line' : '') + '" href="tel:' + esc(V.phone.replace(/[^\d+]/g, '')) + '">' + (compact ? ui('phone', '打電話') : ui('phone', '打電話') + ' ' + esc(V.phone)) + '</a>' : '') +
      (V.line ? '<a class="btn line" href="' + esc(lineHref(svc)) + '">' + esc(ui('line', 'LINE 詢問')) + '</a>' : '') +
      (V.facebookUrl ? '<a class="btn line" href="' + esc(V.facebookUrl) + '" target="_blank" rel="noopener">' + esc(ui('facebook', 'Facebook 私訊')) + '</a>' : '');
  }

  // 預約與詢問：開放狀態、時間地址、預約按鈕，一個區塊講完
  function bookingBarHtml(key, svc) {
    var V = C.visit;
    var fmt = function (t) { return String(t || '').replace(/^0/, ''); };
    var map = 'https://www.google.com/maps/search/?api=1&query=' + encodeURIComponent(V.address);
    return '<section class="booking" id="visit" aria-labelledby="bkH"><div class="wrap booking-in"><div class="booking-head">' + secHead(key, 'bkH', '預約與詢問') +
      '<p class="status" data-status><span class="dot"></span><span class="status-text"></span></p></div>' +
      '<dl class="booking-facts"><div><dt>' + esc(ui('hours', '開放時間')) + '</dt><dd>' + esc(V.openText) + ' ' + fmt(V.open) + '–' + fmt(V.close) + '</dd></div>' +
      '<div><dt>' + esc(ui('address', '地址')) + '</dt><dd><a href="' + map + '" target="_blank" rel="noopener">' + esc(V.address) + '</a>' + (V.transport ? '<small>' + esc(V.transport) + '</small>' : '') + '</dd></div></dl>' +
      bookingFormHtml(svc,'visitBooking') + '</div></section>';
  }

  // 探索更多：社區、媒體報導、影片、山海集、紀錄文章，各一張小圖卡
  function exploreHtml(key) {
    var counts = {towns:shown(D.towns).length,media:shown(D.media).length,videos:shown(D.videos).length};
    var cards = (C.exploreCards || []).filter(function (card) { return !card.hidden && card.title; });
    return '<section class="explore wrap" id="explore" aria-labelledby="exH">' + secHead(key, 'exH', '探索更多') + '<div class="tiles">' + cards.map(function (card, i) {
      var cover = img(card.cover, 600), icon = img(card.icon, 100), href = ContentSettings.linkPath(card.href);
      var tag = href ? 'a' : 'div';
      return '<' + tag + ' class="tile' + (cover ? ' has-img' : ' t' + (i % 3 + 1)) + '"' + (href ? ' href="' + esc(href) + '"' + (card.newTab ? ' target="_blank" rel="noopener noreferrer" aria-label="' + esc(card.title + '（另開新分頁）') + '"' : '') : '') + '>' +
        (cover ? '<img data-ph="1" src="' + esc(cover) + '" alt="' + esc(card.coverAlt || '') + '" loading="lazy" decoding="async">' : '') +
        '<span class="tile-txt">' + (icon ? '<img class="tile-icon" src="' + esc(icon) + '" alt="">' : '') + '<strong>' + esc(card.title) + '</strong><small>' + esc(template(card.description, counts)) + '</small></span></' + tag + '>';
    }).join('') + '</div></section>';
  }

  function shanhaijiHtml(sec) {
    var S = C.shanhaiji || {};
    return '<section class="band" id="shanhaiji" aria-labelledby="sH"><div class="wrap band-in"><div class="covers issues-covers">' +
      shown(D.shanhaiji).map(function (issue) {
        var image = img(issue.cover, 800), href = issueUrl(issue), tag = href ? 'a' : 'div';
        return '<figure class="issue"><' + tag + (href ? ' href="' + esc(href) + '"' : '') + '>' + (image ? '<img src="' + esc(image) + '" alt="' + esc(issue.coverAlt || '') + '" loading="lazy">' : '') + '</' + tag + '><figcaption>' + esc(issue.cardTitle || issue.title) + '</figcaption></figure>';
      }).join('') + '</div><div><h2 id="sH">' + esc((sec && sec.title) || '《山海集》') + '</h2><p>' + esc(S.text) + '</p><div class="btns">' +
      (S.buyUrl ? '<a class="btn" href="' + esc(ContentSettings.linkPath(S.buyUrl)) + '" target="_blank" rel="noopener">' + esc(S.buyText || '購買') + '</a>' : '') +
      (S.blogUrl ? '<a class="btn ghost" href="' + esc(ContentSettings.linkPath(S.blogUrl)) + '" target="_blank" rel="noopener">' + esc(S.blogText || '閱讀部落格') + '</a>' : '') +
      '</div></div></div></section>';
  }

  function ensureLifeFilmSection(s) {
    s.sections=s.sections||[];
    if(s.sections.some(function(x){return x.key==='lifeFilm';}))return;
    var at=s.sections.map(function(x){return x.key;}).indexOf('services');
    if(at<0)at=s.sections.map(function(x){return x.key;}).indexOf('about')+1;
    var about=s.aboutPage||{};
    s.sections.splice(at,0,{key:'lifeFilm',show:true,title:about.filmTitle||'老屋裡的生活影像',intro:about.filmText||'活動、相遇與地方日常，從這裡慢慢看見。滑動照片可瀏覽，點照片可放大。'});
  }
  function ensureOpeningIntro(s) {
    (s.sections||[]).forEach(function(section){
      if(section.key!=='about'||section.introMode==='independent')return;
      if(!section.intro)section.intro=s.description||'';
      section.introMode='independent';
    });
  }
  function ensureFeaturedSection(s) {
    s.sections=s.sections||[];
    if(s.sections.some(function(x){return x.key==='featured';}))return;
    var at=s.sections.map(function(x){return x.key;}).indexOf('services');
    if(at>=0)at++;else{at=s.sections.map(function(x){return x.key;}).indexOf('explore');if(at<0)at=0;}
    s.sections.splice(at,0,{key:'featured',show:!!(s.featuredStory&&s.featuredStory.show),title:'老屋與地方近況',intro:''});
  }
  function featuredStoryHtml() {
    var settings = C.featuredStory || {};
    var section=sectionConf('featured');
    if (section.show===false || !settings.reference) return '';
    var colon = settings.reference.indexOf(':'), type = settings.reference.slice(0,colon), slug = settings.reference.slice(colon+1);
    var config = {media:['媒體報導',mediaUrl],services:['協會服務',serviceUrl],shanhaiji:['山海集',issueUrl]}[type];
    if (!config) return '';
    var item = shown(D[type] || []).filter(function(x) {return (x.slug || x.title) === slug;})[0];
    if (!item) return '';
    var href = config[1](item), image = img(item.cover,1200);
    return '<section class="featured-story wrap" aria-labelledby="featuredStoryHeading"><h2 class="sec-h" id="featuredStoryHeading">'+esc(section.title||'老屋與地方近況')+'</h2>'+(section.intro?'<p class="sec-intro">'+esc(section.intro)+'</p>':'')+'<article class="featured-story-card'+(image?'':' no-image')+'">'+
      (image?'<a class="featured-story-image" href="'+esc(href)+'" tabindex="-1" aria-hidden="true"><img src="'+esc(image)+'" alt="'+esc(item.coverAlt||item.title)+'" loading="lazy" decoding="async"></a>':'')+
      '<div class="featured-story-copy"><p class="meta"><span>'+esc(config[0])+'</span>'+(item.date?'<time datetime="'+esc(item.date)+'">'+longDate(item.date)+'</time>':'')+'</p><h3><a href="'+esc(href)+'">'+esc(item.title)+'</a></h3>'+
      (item.summary?'<p>'+esc(item.summary)+'</p>':'')+'<a class="btn" href="'+esc(href)+'">閱讀故事</a></div></article></section>';
  }

  function renderHome() {
    setTitle('', C.description);
    $('#hero').hidden = false;
    playIntro();
    var needPosts = (C.sections || []).some(function (x) { return x.key === 'posts' && x.show; });
    var postsP = needPosts ? api('posts', { per_page: C.homePostCount || 4, _fields: LIST_FIELDS }) : Promise.resolve([]);
    // 文章讀不到時，首頁其他段落照常顯示
    Promise.all([postsP.catch(function () { return null; }), categoriesP.catch(function () { return []; })]).then(function (r) {
      var posts = r[0] && hideImported(r[0]), cats = r[1];
      view.innerHTML = (C.sections || []).filter(function (x) { return x.show; }).map(function (sec) {
        var k = sec.key;
        if (k === 'about') {
          return sec.intro && sec.intro.trim() ? '<section class="about wrap" id="about" aria-label="首頁開場短文"><p class="about-text">' + esc(sec.intro) + '</p></section>' : '';
        }
        if (k === 'lifeFilm') return lifeFilmHtml(true);
        if (k === 'services') {
          var sv = servicesHtml();
          return sv ? '<section class="svc-home wrap" id="services" aria-labelledby="svH">' + secHead(k, 'svH', '協會的服務') + sv + '</section>' : '';
        }
        if (k === 'featured') return featuredStoryHtml();
        if (k === 'booking') return bookingBarHtml(k);
        if (k === 'events') return eventsHtml(k);
        if (k === 'explore') return exploreHtml(k);
        if (k === 'towns') {
          var tw = townsHtml();
          return tw ? '<section class="towns wrap" id="towns" aria-labelledby="tH">' + secHead(k, 'tH', '小鎮社區人文') + tw + '</section>' : '';
        }
        if (k === 'shanhaiji') return shanhaijiHtml(sec);
        if (k === 'videos') {
          var vids = shown(D.videos).slice(0, 3).map(videoCard).join('');
          return vids ? '<section class="videos wrap" id="videos" aria-labelledby="vdH">' + secHead(k, 'vdH', '影片精選') +
            '<div class="vid-grid">' + vids + '</div><p class="list-more"><a class="more" href="?view=videos">' + esc(ui('allVideos', '看所有影片')) + '</a></p></section>' : '';
        }
        if (k === 'posts') {
          if (posts === null) return '';
          return '<section class="journal wrap" id="journal" aria-labelledby="jH">' + secHead(k, 'jH', '活動紀錄與在地觀察') +
            '<div class="feed">' + listHtml(posts, cats) + '</div><div class="list-more"><a class="more" href="?view=archives">' + esc(ui('allPosts', '看所有文章')) + '</a></div></section>';
        }
        if (k === 'media') {
          var all = mediaSorted();
          if (!all.length) return '';
          return '<section class="journal media wrap" id="media" aria-labelledby="mdH">' + secHead(k, 'mdH', '媒體報導') +
            '<div class="feed">' + mediaListHtml(all.slice(0, sec.count || 3)) + '</div>' +
            (all.length > (sec.count || 3) ? '<div class="list-more"><a class="more" href="?view=media">看全部媒體報導（' + all.length + ' 則）</a></div>' : '') + '</section>';
        }
        if (k === 'visit') return visitHtml(k);
        return '';
      }).join('');
      updateOpenStatus();
      initBookingForms();
      initServiceReveal();
      initLifeFilm();
      if (location.hash) { var el = document.getElementById(location.hash.slice(1)); if (el) el.scrollIntoView(); }
    });
  }

  // 首頁開場：標題逐字出現。每次開啟瀏覽器只播放一次；系統設定減少動態時不播放
  function setupHeroPhoto() {
    var hero = $('#hero'), u = C.hero && C.hero.image;
    if (!u || hero.classList.contains('hero--photo')) return;
    var box = document.createElement('div');
    box.className = 'hero-photo';
    box.innerHTML = '<img src="' + esc(img(u, 2000)) + '" alt="' + esc(C.hero.photoAlt || '') + '" decoding="async" fetchpriority="high" referrerpolicy="no-referrer">';
    box.querySelector('img').addEventListener('error', function () { hero.classList.remove('hero--photo'); box.remove(); });
    hero.insertBefore(box, hero.firstChild);
    hero.classList.add('hero--photo');
  }

  function playIntro() {
    setupHeroPhoto();
    var hero = $('#hero');
    var reduce = window.matchMedia && matchMedia('(prefers-reduced-motion: reduce)').matches;
    var seen = false;
    try { seen = sessionStorage.getItem('fs30-intro') === '1'; sessionStorage.setItem('fs30-intro', '1'); } catch (e) { /* 忽略 */ }
    if (reduce || seen) { hero.classList.add('intro-done'); return; }
    var h = $('#heroName');
    h.innerHTML = Array.prototype.map.call(h.textContent, function (ch, i) { return '<span style="--i:' + i + '">' + esc(ch) + '</span>'; }).join('');
    hero.classList.add('intro');
    setTimeout(function () { hero.classList.add('intro-done'); }, 1900);
  }

  function upcomingEvents(service) {
    var today = taipeiToday();
    return (D.events || []).filter(function (e) {
      return e.title && e.date && (e.end || e.date) >= today && (!service || e.service === service);
    }).sort(function (a, b) { return a.date < b.date ? -1 : 1; });
  }

  function eventsListHtml(list) {
    return '<ul class="ev-list">' + list.map(function (e) {
      var d = e.date.split('-');
      var wd = '日一二三四五六'.charAt(new Date(e.date + 'T00:00:00+08:00').getUTCDay());
      var span = e.end && e.end !== e.date ? '–' + (+e.end.split('-')[1]) + ' 月 ' + (+e.end.split('-')[2]) + ' 日' : '';
      var sv = e.service && findBy(D.services, e.service);
      return '<li class="ev"><p class="ev-date">' + (+d[1]) + ' 月 ' + (+d[2]) + ' 日' + span +
        '<small>週' + wd + (e.time ? '　' + esc(e.time) : '') + '</small></p><div><h3>' +
        (e.link ? '<a href="' + esc(e.link) + '">' + esc(e.title) + '</a>' : esc(e.title)) + '</h3>' +
        (e.place || e.note ? '<p>' + esc([e.place, e.note].filter(Boolean).join('。')) + '</p>' : '') +
        (sv ? '<p class="ev-svc"><a href="' + serviceUrl(sv) + '">' + esc(sv.title) + '</a></p>' : '') + '</div></li>';
    }).join('') + '</ul>';
  }

  function eventsHtml(key) {
    var list = upcomingEvents();
    if (!list.length) return '';
    return '<section class="events wrap" id="events" aria-labelledby="evH">' + secHead(key, 'evH', '近期活動') + eventsListHtml(list) + '</section>';
  }

  function visitHtml(key) {
    var V = C.visit;
    var fmt = function (t) { return String(t || '').replace(/^0/, ''); };
    var map = 'https://www.google.com/maps/search/?api=1&query=' + encodeURIComponent(V.address);
    return '<section class="visit wrap" id="visit" aria-labelledby="vH">' + secHead(key, 'vH', '到訪陳家古厝') + '<div class="visit-grid">' +
      '<div><p class="k">' + esc(ui('address', '地址')) + '</p><p class="val"><a href="' + map + '" target="_blank" rel="noopener">' + esc(V.address.slice(0, 6)) + '<br>' + esc(V.address.slice(6)) + '</a></p>' +
      (V.transport ? '<p class="visit-note">' + esc(V.transport) + '</p>' : '') + '</div>' +
      '<div><p class="k">' + esc(ui('hours', '開放時間')) + '</p><p class="val">' + esc(V.openText) + '<br>' + fmt(V.open) + '–' + fmt(V.close) + '</p>' +
      '<p class="status" data-status aria-live="polite"><span class="dot"></span><span class="status-text"></span></p></div>' +
      '<div><p class="k">' + esc(ui('contact', '聯絡')) + '</p><p class="val">' +
      (V.phone ? '<a href="tel:' + esc(V.phone.replace(/[^\d+]/g, '')) + '">' + esc(V.phone) + '</a><br>' : '') +
      (V.email ? '<a href="mailto:' + esc(V.email) + '">' + esc(V.email) + '</a><br>' : '') +
      (V.facebookUrl ? '<a href="' + esc(V.facebookUrl) + '" target="_blank" rel="noopener">Facebook：' + esc(V.facebookLabel || '粉絲專頁') + '</a>' : '') +
      (V.line ? '<br><a href="' + esc(lineHref()) + '">' + esc(ui('line','LINE 官方客服')) + (V.line.charAt(0) === '@' ? ' ' + esc(V.line) : '') + '</a>' : '') +
      (V.bookingUrl ? '<br><a href="' + esc(V.bookingUrl) + '" target="_blank" rel="noopener">' + esc(ui('bookingForm', '填寫預約表單')) + '</a>' : '') + '</p></div></div></section>';
  }

  // 依台北時間顯示現在是否開放
  function updateOpenStatus() {
    var els = $$('[data-status]');
    if (!els.length || !C || !C.visit) return;
    var state = VisitHours.status(C.visit);
    var now = Date.now(), today = new Date(now + 28800000).toISOString().slice(0, 10);
    function clock(n) {
      return new Intl.DateTimeFormat('zh-TW', {timeZone:'Asia/Taipei',hour:'2-digit',minute:'2-digit',hourCycle:'h23'}).format(new Date(n));
    }
    function nextText(n) {
      var day = new Date(n + 28800000).toISOString().slice(0, 10);
      var tomorrow = new Date(now + 28800000 + 86400000).toISOString().slice(0, 10);
      var label = day === today ? '今天' : day === tomorrow ? '明天' : new Intl.DateTimeFormat('zh-TW', {timeZone:'Asia/Taipei',month:'numeric',day:'numeric',weekday:'short',year:'numeric'}).format(new Date(n));
      return template(ui('closedStatus', '目前休館，{day} {time} 開放'), {day:label,time:clock(n)});
    }
    var msg;
    if (state.open) msg = template(ui('openStatus', '現在開放中，今天到 {time}'), {time:clock(state.until)});
    else if (state.exceptional) {
      msg = ui('temporaryClosedStatus', '臨時休館') + (state.reason ? '：' + state.reason : '');
      if (state.next) msg += '。' + nextText(state.next);
      else if ((C.visit.temporaryClosure || {}).active) msg += '。' + ui('reopeningPending', '恢復開放時間另行公告');
    } else msg = state.next ? nextText(state.next) : ui('closedNoSchedule', '目前休館，開放時間請洽協會');
    els.forEach(function (el) {
      el.hidden = false;
      el.classList.toggle('open', state.open);
      el.querySelector('.status-text').textContent = msg;
    });
  }

  /* ---------- 媒體報導 ---------- */

  function mediaUrl(x) { return q({ media: x.slug || x.title }); }
  function mediaSorted() {
    return shown(D.media).slice().sort(function (a, b) { return (b.date || '') < (a.date || '') ? -1 : 1; });
  }
  function mediaListHtml(list) {
    return list.map(function (x, i) {
      var src = img(x.cover, 480);
      return '<article class="post"><div class="p-date"><span>' + esc(dotDate(x.date || '')) + '</span>' + (x.outlet ? '<span>' + esc(x.outlet) + '</span>' : '') + '</div>' +
        '<div><h3><a href="' + mediaUrl(x) + '">' + esc(x.title) + '</a></h3>' + (x.summary ? '<p>' + esc(x.summary) + '</p>' : '') + '</div>' +
        '<div class="ph thumb t' + (i % 3 + 1) + '" aria-hidden="true">' + (src ? '<img data-ph="1" src="' + esc(src) + '" alt="' + esc(x.coverAlt || '') + '" loading="lazy" decoding="async" referrerpolicy="no-referrer">' : '') + '</div></article>';
    }).join('');
  }
  function renderMediaIndex() {
    var conf = sectionConf('media');
    var t = conf.title || '媒體報導';
    setTitle(t);
    var list = mediaSorted();
    view.innerHTML = '<div class="wrap list-page"><header class="list-head"><h1>' + esc(t) + '</h1>' +
      (conf.intro ? '<p>' + esc(conf.intro) + '</p>' : '') + '</header>' +
      (list.length ? '<div class="feed">' + mediaListHtml(list) + '</div>' : '<p class="c-empty">' + esc(ui('emptyMedia', '目前還沒有媒體報導。')) + '</p>') + '</div>';
  }
  function renderMediaDetail(slug) {
    var issue = shown(D.shanhaiji).filter(function (x) { return x.slug === slug || (x.legacyMediaSlugs || []).indexOf(slug) >= 0; })[0];
    if (issue) return renderIssueDetail(issue.slug);
    var x = findBy(D.media, slug);
    if (!x) { var e = new Error('not found'); e.notFound = true; return showError(e, '報導'); }
    setTitle(x.title, x.summary || C.description);
    var cover = img(x.cover, 1600);
    var body = clean(x.body || '');
    var first = (body.match(/<img[^>]+src="([^"]+)"/) || [])[1];
    var share = location.origin + location.pathname + mediaUrl(x);
    view.innerHTML = '<article class="wrap art"><a class="back" href="?view=media">' + esc(ui('allMedia', '所有媒體報導')) + '</a><div class="art-grid">' +
      '<header class="art-head"><div class="meta"><span>媒體報導</span>' + (x.date ? '<time datetime="' + esc(x.date) + '">' + longDate(x.date) + '</time>' : '') +
      (x.outlet ? '<span>' + esc(x.outlet) + '</span>' : '') + '</div><h1>' + esc(x.title) + '</h1></header>' +
      (cover && imageKey(cover) !== imageKey(first) ? '<div class="art-cover"><div class="ph t2" style="aspect-ratio:16/9"><img data-ph="1" src="' + esc(cover) + '" alt="' + esc(x.coverAlt || '') + '" decoding="async" referrerpolicy="no-referrer"></div></div>' : '') +
      '<div class="prose">' + (x.summary && !body ? '<p>' + esc(x.summary) + '</p>' : '') + '<div class="entry">' + body + '</div>' +
      (x.url ? '<p style="margin-top:28px"><a class="btn" href="' + esc(x.url) + '" target="_blank" rel="noopener">' + esc(ui('mediaOriginal','閱讀原始報導')) + (x.outlet ? '（' + esc(x.outlet) + '）' : '') + '</a></p>' : '') +
      '<div class="art-foot">' + shareHtml(x.title, share) + '</div></div></div></article>';
  }

  function issueUrl(x) { return q({issue:x.slug || x.title}); }
  function issueActionsHtml(x) {
    var buy = ContentSettings.linkPath(x.buyUrl || ''), read = ContentSettings.linkPath(x.readingUrl || '');
    if (!buy && !read) return '';
    return '<div class="issue-actions">' +
      (buy ? '<a class="btn" href="' + esc(buy) + '" target="_blank" rel="noopener">' + esc(ui('issueBuy','購買本期')) + '</a>' : '') +
      (read ? '<a class="btn" href="' + esc(read) + '" target="_blank" rel="noopener">' + esc(ui('issueReadMore','電子版／延伸閱讀')) + '</a>' : '') + '</div>';
  }
  function otherIssuesHtml(current) {
    var list = shown(D.shanhaiji), at = list.map(function (x) { return x.slug; }).indexOf(current.slug);
    var neighbors = [];
    if (at > 0) neighbors.push({item:list[at - 1],label:ui('previousIssue','前一期'),rel:'prev'});
    if (at >= 0 && at + 1 < list.length) neighbors.push({item:list[at + 1],label:ui('nextIssue','後一期'),rel:'next'});
    return '<nav class="issue-related" aria-labelledby="otherIssuesTitle"><h2 id="otherIssuesTitle">' + esc(ui('otherIssues','其他期山海集')) + '</h2>' +
      (neighbors.length ? '<div class="issue-related-grid">' + neighbors.map(function (neighbor) {
        var x = neighbor.item, cover = img(x.cover, 480);
        return '<a class="issue-related-card" rel="' + neighbor.rel + '" href="' + esc(issueUrl(x)) + '">' +
          '<small>' + esc(neighbor.label) + '</small>' +
          (cover ? '<img src="' + esc(cover) + '" alt="' + esc(x.coverAlt || x.cardTitle || x.title) + '" loading="lazy" decoding="async">' : '') +
          '<span>' + esc(x.cardTitle || x.title) + '</span></a>';
      }).join('') + '</div>' : '') +
      '<p class="issue-all"><a class="btn" href="?view=shanhaiji">' + esc(ui('allIssueLink','看全部山海集')) + '</a></p></nav>';
  }

  function renderIssueDetail(slug) {
    var x = findBy(D.shanhaiji, slug);
    if (!x) { var e = new Error('not found'); e.notFound = true; return showError(e, '山海集'); }
    setTitle(x.title, x.summary || C.description);
    var cover = img(x.cover, 1600), body = clean(x.body || '');
    var first = (body.match(/<img[^>]+src="([^"]+)"/) || [])[1];
    var share = location.origin + location.pathname + issueUrl(x);
    view.innerHTML = '<article class="wrap art"><a class="back" href="?view=shanhaiji">' + esc(ui('allIssues','所有山海集')) + '</a><div class="art-grid">' +
      '<header class="art-head"><div class="meta"><span>' + esc(ui('issueLabel','山海集')) + '</span>' + (x.date ? '<time datetime="' + esc(x.date) + '">' + longDate(x.date) + '</time>' : '') +
      '</div><h1>' + esc(x.title) + '</h1></header>' +
      (cover && imageKey(cover) !== imageKey(first) ? '<div class="art-cover"><img src="' + esc(cover) + '" alt="' + esc(x.coverAlt || '') + '" style="display:block;width:100%;max-height:640px;object-fit:contain" decoding="async"></div>' : '') +
      '<div class="prose">' + (x.summary && !body ? '<p>' + esc(x.summary) + '</p>' : '') + '<div class="entry">' + body + '</div>' + galleryHtml(x.gallery) +
      issueActionsHtml(x) +
      '<div class="art-foot">' + shareHtml(x.title, share) + '</div>' + otherIssuesHtml(x) + '</div></div></article>';
  }

  /* ---------- 服務、社區、影片 ---------- */

  function galleryHtml(list) {
    return '<div class="gallery-grid">' + (list || []).map(function (item) {
      var photo = typeof item === 'string' ? {image:item,alt:'',caption:''} : item;
      var image = img(photo.image, 1600); if (!image) return '';
      return '<figure><img src="' + esc(image) + '" data-full="' + esc(image) + '" alt="' + esc(photo.alt || '') + '" loading="lazy" decoding="async">' + (photo.caption ? '<figcaption>' + esc(photo.caption) + '</figcaption>' : '') + '</figure>';
    }).join('') + '</div>';
  }

  function loadRelatedPosts(x, box) {
    if (!x.relatedCategory && !x.relatedTag) return;
    var tagP = x.relatedTag ? api('tags', { slug: x.relatedTag, _fields: 'id' }).then(function (l) { return l[0] && l[0].id; }) : Promise.resolve(null);
    Promise.all([categoriesP, tagP]).then(function (r) {
      var cat = x.relatedCategory && r[0].filter(function (c) { return c.name === x.relatedCategory || c.slugText === x.relatedCategory; })[0];
      var query = { per_page: 6, _fields: LIST_FIELDS };
      if (r[1]) query.tags = r[1];
      else if (cat) query.categories = cat.id;
      else return;
      return api('posts', query).then(function (posts) {
        if (!posts.length) return;
        box.innerHTML = '<h2>' + esc(ui('related', '相關紀錄')) + '</h2><div class="feed">' + listHtml(posts, r[0]) + '</div>' +
          '<p class="list-more"><a class="more" href="' + (r[1] ? q({ tag: x.relatedTag }) : catUrl(cat)) + '">' + esc(ui('more', '看更多')) + '</a></p>';
        box.hidden = false;
      });
    }).catch(function () {});
  }

  function detailHtml(x, kind) {
    var cover = img(x.cover, 1600);
    var info = '';
    if (kind === 'service') {
      var rows = [[ui('audience', '適合對象'), x.audience], [ui('duration', '所需時間'), x.duration], [ui('capacity', '人數'), x.capacity], [ui('fee', '費用'), x.fee]].filter(function (r) { return r[1]; });
      var book = bookingUrl(x), V = C.visit;
      info = '<aside class="svc-info" aria-label="服務資訊">' +
        (rows.length ? '<dl>' + rows.map(function (r) { return '<dt>' + esc(r[0]) + '</dt><dd>' + esc(r[1]) + '</dd>'; }).join('') + '</dl>' : '') +
        '<div class="svc-book">' + bookingActs(x) +
        (V.email ? '<a class="more" href="mailto:' + esc(V.email) + '?subject=' + encodeURIComponent('詢問：' + x.title) + '">' + esc(ui('email', 'Email 詢問')) + '</a>' : '') +
        '</div></aside>';
    } else if (x.mapUrl) {
      info = '<aside class="svc-info"><div class="svc-book"><a class="btn" href="' + esc(x.mapUrl) + '" target="_blank" rel="noopener">' + esc(ui('map', '在地圖上看')) + '</a></div></aside>';
    }
    var evs = kind === 'service' ? upcomingEvents(x.slug || x.title) : [];
    var back = kind === 'service' ? '<a class="back" href="?view=services">' + esc(ui('allServices', '所有服務')) + '</a>' : '<a class="back" href="?view=towns">' + esc(ui('allTowns', '所有社區')) + '</a>';
    return '<article class="wrap detail">' + back +
      '<header class="detail-head"><p class="meta"><span>' + (kind === 'service' ? '協會服務' : '小鎮社區人文') + '</span></p><h1>' + esc(x.title) + '</h1>' +
      (x.summary ? '<p class="lead">' + esc(x.summary) + '</p>' : '') + '</header>' +
      (cover ? '<div class="art-cover"><div class="ph t2" style="aspect-ratio:16/9"><img data-ph="1" src="' + esc(cover) + '" alt="' + esc(x.coverAlt || '') + '" decoding="async" referrerpolicy="no-referrer"></div></div>' : '') +
      '<div class="detail-grid"><div class="prose"><div class="entry">' + clean(x.body || '') + '</div>' + galleryHtml(x.gallery) + '</div>' + info + '</div>' +
      (evs.length ? '<section class="detail-sec" aria-labelledby="dEv"><h2 id="dEv">近期活動</h2>' + eventsListHtml(evs) + '</section>' : '') +
      '<section class="detail-sec" id="relPosts" hidden></section>' +
      (kind === 'service' ? '<div class="m-book" role="region" aria-label="預約">' + bookingActs(x, true) + '</div>' : '') +
      '</article>';
  }

  // 服務頁：大照片 → 名稱與一句話 → 服務資訊與預約 → 內容 → 照片 → 預約須知 → 近期場次 → 相關紀錄 → 其他服務 → 預約與詢問
  function serviceHtml(x) {
    var cover = img(x.cover, 2000), f = factsOf(x);
    var notes = String(x.notes || '').split('\n').map(function (s) { return s.trim(); }).filter(Boolean);
    var evs = upcomingEvents(x.slug || x.title);
    var others = shown(D.services).filter(function (o) { return o !== x; }).slice(0, 3);
    return '<article class="svc-page">' +
      (cover ? '<div class="svc-hero ph t2"><img data-ph="1" src="' + esc(cover) + '" alt="' + esc(x.coverAlt || '') + '" decoding="async" fetchpriority="high" referrerpolicy="no-referrer"></div>' : '') +
      '<div class="wrap"><a class="back" href="?view=services">' + esc(ui('allServices', '所有服務')) + '</a>' +
      '<header class="svc-head"><h1>' + esc(x.title) + '</h1>' + (x.summary ? '<p class="lead">' + esc(x.summary) + '</p>' : '') + '</header>' +
      '<div class="svc-bar">' + (f.length ? '<dl class="facts">' + f.map(function (r) { return '<div><dt>' + r[0] + '</dt><dd>' + esc(r[1]) + '</dd></div>'; }).join('') + '</dl>' : '') +
      '<div class="svc-bar-acts">' + bookingActs(x) + '</div></div>' +
      '<div class="prose svc-body"><div class="entry">' + clean(x.body || '') + '</div>' + galleryHtml(x.gallery) + '</div>' +
      (notes.length ? '<section class="svc-sec" aria-labelledby="ntH"><h2 id="ntH">' + esc(ui('bookingNotes', '預約須知')) + '</h2><ul class="notes">' + notes.map(function (n) { return '<li>' + esc(n) + '</li>'; }).join('') + '</ul></section>' : '') +
      (evs.length ? '<section class="svc-sec" aria-labelledby="evH2"><h2 id="evH2">' + esc(ui('upcoming', '近期場次')) + '</h2>' + eventsListHtml(evs) + '</section>' : '') +
      '<section class="svc-sec" id="relPosts" hidden></section>' +
      (others.length ? '<section class="svc-sec" aria-labelledby="otH"><h2 id="otH">' + esc(ui('otherServices', '其他服務')) + '</h2><div class="others">' + others.map(svcCard).join('') + '</div></section>' : '') +
      '</div>' + bookingBarHtml('booking', x) +
      '<div class="m-book" role="region" aria-label="預約">' + bookingActs(x, true) + '</div></article>';
  }

  function renderDetail(kind, slug) {
    var x = findBy(kind === 'service' ? D.services : D.towns, slug);
    if (!x) { var e = new Error('not found'); e.notFound = true; return showError(e, kind === 'service' ? '服務' : '社區頁'); }
    setTitle(x.title, x.summary || C.description);
    view.innerHTML = kind === 'service' ? serviceHtml(x) : detailHtml(x, kind);
    if (kind === 'service') { updateOpenStatus(); initBookingForms(); initServiceReveal(); }
    loadRelatedPosts(x, $('#relPosts'));
  }

  function renderIndex(kind) {
    var isSvc = kind === 'services';
    var conf = sectionConf(isSvc ? 'services' : 'towns');
    setTitle(conf.title || (isSvc ? '協會的服務' : '小鎮社區人文'));
    view.innerHTML = '<div class="wrap list-page"><header class="list-head"><h1>' + esc(conf.title || (isSvc ? '協會的服務' : '小鎮社區人文')) + '</h1>' +
      (conf.intro ? '<p>' + esc(conf.intro) + '</p>' : '') + '</header>' +
      ((isSvc ? servicesHtml() : townsHtml()) || '<p class="c-empty">' + esc(ui('empty', '目前沒有內容。')) + '</p>') + '</div>' +
      (isSvc ? bookingBarHtml('booking') : '');
    updateOpenStatus();
    initBookingForms();
    if (isSvc) initServiceReveal();
  }

  function renderVideos() {
    var conf = sectionConf('videos');
    setTitle(conf.title || '影片精選');
    var vids = shown(D.videos).map(videoCard).join('');
    view.innerHTML = '<div class="wrap list-page"><header class="list-head"><h1>' + esc(conf.title || '影片精選') + '</h1>' +
      (conf.intro ? '<p>' + esc(conf.intro) + '</p>' : '') + '</header>' +
      (vids ? '<div class="vid-grid">' + vids + '</div>' : '<p class="c-empty">' + esc(ui('emptyVideos', '目前還沒有影片。')) + '</p>') + '</div>';
  }

  /* ---------- 文章 ---------- */

  function renderPost(idOrSlug) {
    var getPost = /^\d+$/.test(idOrSlug)
      ? api('posts/' + idOrSlug, { _fields: POST_FIELDS })
      : api('posts', { slug: idOrSlug, _fields: POST_FIELDS }).then(function (l) {
          if (!l.length) { var e = new Error('not found'); e.notFound = true; throw e; }
          return l[0];
        });
    Promise.all([getPost, categoriesP]).then(function (r) {
      var p = r[0], cats = r[1];
      var cs = catsById(p.categories, cats);
      var t = title(p);
      setTitle(t, excerpt(p, 150));
      if (history.replaceState && !params.get('p')) history.replaceState(null, '', postUrl(p) + location.hash);

      var body = clean(p.content && p.content.rendered);
      var first = (body.match(/<img[^>]+src="([^"]+)"/) || [])[1];
      var cover = p.jetpack_featured_media_url;
      var coverHtml = cover && imageKey(cover) !== imageKey(first)
        ? '<div class="art-cover"><div class="ph t2" style="aspect-ratio:16/9"><img data-ph="1" src="' + esc(sized(cover, 1400)) +
          '" srcset="' + esc(sized(cover, 800)) + ' 800w, ' + esc(sized(cover, 1400)) + ' 1400w, ' + esc(sized(cover, 2000)) + ' 2000w" sizes="(max-width:1120px) 100vw, 1120px" alt="" decoding="async" referrerpolicy="no-referrer"></div></div>'
        : '';
      var share = location.origin + location.pathname + postUrl(p);

      view.innerHTML = '<article class="wrap art"><a class="back" href="./#journal">回到文章列表</a><div class="art-grid">' +
        '<header class="art-head"><div class="meta"><time datetime="' + esc(p.date) + '">' + longDate(p.date) + '</time>' +
        cs.map(function (c) { return '<a href="' + catUrl(c) + '">' + esc(c.name) + '</a>'; }).join('') + '</div><h1>' + esc(t) + '</h1></header>' +
        coverHtml +
        '<div class="prose"><div class="entry">' + body + '</div>' +
        '<div class="art-foot"><div class="tags" id="tags"></div>' + shareHtml(t, share) + '</div>' +
        '<section class="comments" aria-labelledby="chead"><h2 class="c-h" id="chead">留言</h2><div id="clist"><p class="loading">讀取留言…</p></div>' +
        (p.comment_status === 'open'
          ? '<div class="c-write"><a class="btn" href="' + esc(https(p.link)) + '#respond" target="_blank" rel="noopener">' + esc(ui('writeComment', '我要留言')) + '</a>' +
            '<p>' + esc(ui('commentHint', '會開啟原網站的留言表單，填暱稱和 Email 就能留言。送出後回到這裡重新整理，就會看到你的留言（有些留言需要審核後才會顯示）。')) + '</p></div>'
          : '<p class="c-off">' + esc(ui('commentsClosed', '這篇文章已關閉留言。')) + '</p>') +
        '</section><section class="related" id="related" aria-labelledby="relH" hidden></section></div></div>' +
        '<nav class="pn" id="pn" aria-label="上下篇"></nav></article>';

      loadComments(p.id);
      loadTags(p.tags);
      loadNeighbors(p);
      loadRelated(p);
      if (location.hash) setTimeout(function () { var el = document.getElementById(location.hash.slice(1)); if (el) el.scrollIntoView(); }, 300);
    }).catch(function (e) { showError(e, '文章'); });
  }

  function shareHtml(t, u) {
    var eu = encodeURIComponent(u), et = encodeURIComponent(t);
    var lineUrl = new URL(u, location.href);
    lineUrl.searchParams.set('openExternalBrowser', '1');
    var lineShareUrl = encodeURIComponent(lineUrl.href);
    return '<div class="share" role="group" aria-label="分享這篇文章"><p class="share-q">' + esc(ui('share', '分享')) + '</p>' +
      '<a href="https://social-plugins.line.me/lineit/share?url=' + lineShareUrl + '" target="_blank" rel="noopener">LINE</a>' +
      '<a href="https://www.facebook.com/sharer/sharer.php?u=' + eu + '" target="_blank" rel="noopener">' + esc(ui('footerFacebook','Facebook')) + '</a>' +
      '<a href="https://twitter.com/intent/tweet?url=' + eu + '&text=' + et + '" target="_blank" rel="noopener">X</a>' +
      '<button type="button" data-copy="' + esc(u) + '">' + esc(ui('copyLink', '複製連結')) + '</button></div>';
  }

  function loadComments(postId) {
    allPages('comments', { post: postId, order: 'asc', _fields: 'id,parent,author_name,date,content' }).then(function (list) {
      var byId = {}, roots = [];
      list.forEach(function (c) { c.children = []; byId[c.id] = c; });
      list.forEach(function (c) { (c.parent && byId[c.parent] ? byId[c.parent].children : roots).push(c); });
      var tree = function (arr) {
        return '<ul class="c-list">' + arr.map(function (c) {
          return '<li class="c-item" id="comment-' + c.id + '"><div><span class="c-name">' + esc(text(c.author_name) || '訪客') + '</span>' +
            '<span class="c-time">' + longDate(c.date) + '</span></div><div class="c-body">' + clean(c.content && c.content.rendered, true) + '</div>' +
            (c.children.length ? tree(c.children) : '') + '</li>';
        }).join('') + '</ul>';
      };
      $('#chead').textContent = ui('comments', '留言') + (list.length ? '（' + list.length + '）' : '');
      $('#clist').innerHTML = list.length ? '<div class="old-c" style="margin-top:0">' + tree(roots) + '</div>' : '<p class="c-empty">' + esc(ui('noComments', '還沒有人留言，留下第一則吧。')) + '</p>';
    }).catch(function () {
      $('#clist').innerHTML = '<p class="c-empty">' + esc(ui('commentUnavailable', '暫時讀不到留言，請稍後重新整理。')) + '</p>';
    });
  }

  function loadTags(ids) {
    if (!ids || !ids.length) return;
    api('tags', { include: ids.join(','), _fields: 'id,name,slug' }).then(function (list) {
      $('#tags').innerHTML = list.map(function (t) {
        return '<a href="' + tagUrl({ slugText: decodeSlug(t.slug) }) + '">#' + esc(text(t.name)) + '</a>';
      }).join('');
    }).catch(function () {});
  }

  function loadNeighbors(p) {
    var f = { per_page: 1, _fields: 'id,title' };
    Promise.all([
      api('posts', Object.assign({ before: p.date }, f)).catch(function () { return []; }),
      api('posts', Object.assign({ after: p.date, order: 'asc' }, f)).catch(function () { return []; }),
    ]).then(function (r) {
      var older = r[0][0], newer = r[1][0];
      var link = function (x, label, rel) {
        return x ? '<a href="' + postUrl(x) + '" rel="' + rel + '"><small>' + label + '</small><span>' + esc(title(x)) + '</span></a>' : '<span></span>';
      };
      $('#pn').innerHTML = link(older, '較舊的文章', 'prev') + link(newer, '較新的文章', 'next');
    });
  }

  function loadRelated(p) {
    if (!p.categories || !p.categories.length) return;
    api('posts', { categories: p.categories[0], exclude: p.id, per_page: 3, _fields: 'id,date,title' }).then(function (list) {
      if (!list.length) return;
      var box = $('#related');
      box.innerHTML = '<h2 id="relH">相關文章</h2><ul>' + list.map(function (r) {
        return '<li><small>' + longDate(r.date) + '</small><a href="' + postUrl(r) + '">' + esc(title(r)) + '</a></li>';
      }).join('') + '</ul>';
      box.hidden = false;
    }).catch(function () {});
  }

  /* ---------- 頁面（協會服務、社區人文等） ---------- */

  function renderPage(idOrSlug) {
    var getPage = /^\d+$/.test(idOrSlug)
      ? api('pages/' + idOrSlug, { _fields: 'id,title,content,excerpt,parent,link' })
      : api('pages', { slug: idOrSlug, _fields: 'id,title,content,excerpt,parent,link' }).then(function (l) {
          if (!l.length) { var e = new Error('not found'); e.notFound = true; throw e; }
          return l[0];
        });
    Promise.all([getPage, pagesP.catch(function () { return []; })]).then(function (r) {
      var p = r[0], pages = r[1];
      var t = title(p);
      setTitle(t, excerpt(p, 150));
      if (history.replaceState && !params.get('page_id')) history.replaceState(null, '', pageUrl(p) + location.hash);
      var parent = pages.filter(function (x) { return x.id === p.parent; })[0];
      var kids = pages.filter(function (x) { return x.parent === p.id; }).sort(function (a, b) { return a.order - b.order; });
      view.innerHTML = '<article class="wrap art">' +
        (parent ? '<a class="back" href="' + pageUrl(parent) + '">回到「' + esc(parent.title) + '」</a>' : '<a class="back" href="./">回到首頁</a>') +
        '<div class="art-grid"><header class="art-head"><h1>' + esc(t) + '</h1></header>' +
        '<div class="prose"><div class="entry">' + clean(p.content && p.content.rendered) + '</div>' +
        (kids.length ? '<section class="related page-kids"><h2>這個單元的頁面</h2><ul>' +
          kids.map(function (k) { return '<li><a href="' + pageUrl(k) + '">' + esc(k.title) + '</a></li>'; }).join('') + '</ul></section>' : '') +
        '</div></div></article>';
    }).catch(function (e) {
      // 舊網址的代稱可能是文章而不是頁面，再試一次
      if (e.notFound && !/^\d+$/.test(idOrSlug)) renderPost(idOrSlug);
      else showError(e, '頁面');
    });
  }

  /* ---------- 列表：所有文章、分類、標籤、搜尋 ---------- */

  function renderList(opts) {
    var n = Math.max(1, parseInt(params.get('paged'), 10) || 1);
    var per = C.perPage;
    // 第 1 頁的列表接在首頁之後：首頁已經顯示了最新的幾篇
    var offset = (n - 1) * per;
    var query = Object.assign({ per_page: per + 1, offset: offset, _fields: LIST_FIELDS }, opts.query || {});
    Promise.all([api('posts', query), categoriesP]).then(function (r) {
      var posts = r[0], cats = r[1];
      var hasMore = posts.length > per;
      posts = posts.slice(0, per);
      setTitle(opts.title + (n > 1 ? '（第 ' + n + ' 頁）' : ''));
      view.innerHTML = '<div class="wrap list-page"><header class="list-head">' +
        (opts.label ? '<p class="meta"><span>' + esc(opts.label) + '</span></p>' : '') +
        '<h1>' + esc(opts.title) + '</h1>' + (opts.note ? '<p>' + opts.note + '</p>' : '') + '</header>' +
        (opts.form || '') + (opts.local && (parseInt(params.get('paged'), 10) || 1) === 1 ? opts.local : '') +
        (opts.showFilter ? filterHtml(cats, opts.catId) : '') +
        (opts.form && !posts.length ? (opts.local ? '' : '<p class="search-hint">找不到相關文章，換個關鍵字試試，或看 <a href="?view=archives">' + esc(ui('footerPosts','所有文章')) + '</a>。</p>')
          : '<div class="feed" style="margin-top:20px">' + listHtml(posts, cats, n) + '</div>') +
        pagerHtml(n, hasMore, opts.keep || {}) + '</div>';
    }).catch(function (e) { showError(e); });
  }

  function renderCategory(slug) {
    if (isMediaCat(slug)) return renderMediaIndex();
    categoriesP.then(function (cats) {
      var c = cats.filter(function (x) { return x.slugText === slug || x.slug === slug || String(x.id) === slug || x.name === slug; })[0];
      if (!c) { var e = new Error('not found'); e.notFound = true; throw e; }
      renderList({ title: c.name, label: '分類', note: '共 ' + c.count + ' 篇。', query: { categories: c.id }, keep: { category_name: c.slugText }, showFilter: true, catId: c.id });
    }).catch(function (e) { showError(e, '分類'); });
  }

  function renderTag(slug) {
    api('tags', { slug: slug, _fields: 'id,name,count' }).then(function (l) {
      var t = l[0];
      if (!t) { var e = new Error('not found'); e.notFound = true; throw e; }
      renderList({ title: text(t.name), label: '標籤', note: '共 ' + t.count + ' 篇。', query: { tags: t.id }, keep: { tag: slug } });
    }).catch(function (e) { showError(e, '標籤'); });
  }

  function searchForm(v) {
    return '<form class="search-form" role="search" action="./" method="get"><label class="sr" for="sq">' + esc(ui('searchLabel','搜尋關鍵字')) + '</label>' +
      '<input id="sq" name="s" type="search" value="' + esc(v || '') + '" placeholder="' + esc(ui('searchPlaceholder','例如：金紙、慈裕宮、手抄紙')) + '" required>' +
      '<button class="btn" type="submit">' + esc(ui('search','搜尋')) + '</button></form>';
  }

  function renderSearch(term) {
    if (!term) {
      setTitle(ui('search','搜尋'));
      view.innerHTML = '<div class="wrap list-page"><header class="list-head"><h1>' + esc(ui('search','搜尋')) + '</h1><p>' + esc(ui('searchIntro','輸入關鍵字，找文章。')) + '</p></header>' + searchForm('') + '</div>';
      var i = $('#sq'); if (i) i.focus();
      return;
    }
    renderList({ title: template(ui('searchResultsTitle','搜尋「{term}」'),{term:term}), label: ui('searchResultsLabel','搜尋結果'), query: { search: term }, keep: { s: term }, form: searchForm(term), local: localMatches(term) });
  }

  // 在服務、社區、媒體報導、影片裡找關鍵字（這些內容不在 WordPress，WordPress 搜尋找不到）
  function localMatches(term) {
    var t = term.toLowerCase(), out = [];
    var tmp = document.createElement('div');
    var has = function (x) {
      tmp.innerHTML = x.body || '';
      return [x.title, x.summary, x.outlet, x.description, tmp.textContent].join(' ').toLowerCase().indexOf(t) >= 0;
    };
    if (C.aboutPage && has(C.aboutPage)) out.push([ui('aboutTitle','關於我們'), C.aboutPage.title || ui('aboutTitle','關於我們'), '?view=about']);
    shown(D.services).filter(has).forEach(function (x) { out.push(['協會服務', x.title, serviceUrl(x)]); });
    shown(D.towns).filter(has).forEach(function (x) { out.push(['社區人文', x.title, townUrl(x)]); });
    shown(D.shanhaiji).filter(has).forEach(function (x) { out.push([ui('issueLabel','山海集'), x.title, issueUrl(x)]); });
    mediaSorted().filter(has).forEach(function (x) { out.push(['媒體報導', x.title, mediaUrl(x)]); });
    shown(D.videos).filter(has).forEach(function (x) { out.push(['影片', x.title, '?view=videos']); });
    if (!out.length) return '';
    return '<section class="related" style="margin:28px 0 8px"><h2>' + esc(ui('localResultsTitle','網站頁面')) + '</h2><ul>' + out.map(function (o) {
      return '<li><small>' + o[0] + '</small><a href="' + esc(o[2]) + '">' + esc(o[1]) + '</a></li>';
    }).join('') + '</ul></section>';
  }

  function lifeFilmHtml(home) {
    var about = C.aboutPage || {};
    if (!home && about.filmShow === false) return '';
    var albums = C.photoCollections || [], key = about.filmAlbum || 'wp-378';
    var album = albums.filter(function (x) { return x.key === key; })[0];
    var photos = (album && album.gallery || []).filter(function (x) { return !x.hidden && img(x.image,800); });
    if (!photos.length) return '';
    function group(duplicate) {
      return '<div class="life-film-group"' + (duplicate ? ' aria-hidden="true"' : '') + '>' + photos.map(function (x,i) {
        var image = img(x.image,1000);
        return '<figure><img src="' + esc(image) + '" data-full="' + esc(image) + '"' + (duplicate ? '' : ' role="button" tabindex="0"') + ' alt="' + (duplicate ? '' : esc(x.alt || x.caption || template(ui('lifeFilmAlt','古厝生活影像 {number}'),{number:i+1}))) + '" loading="lazy" decoding="async">' + (x.caption ? '<figcaption>' + esc(x.caption) + '</figcaption>' : '') + '</figure>';
      }).join('') + '</div>';
    }
    var conf=home?sectionConf('lifeFilm'):null;
    return '<section class="life-film'+(home?' wrap':'')+'" id="lifeFilm" aria-labelledby="lifeFilmTitle"><div class="life-film-head"><div><h2'+(home?' class="sec-h"':'')+' id="lifeFilmTitle">' + esc(home?conf.title:(about.filmTitle || ui('lifeFilmTitle','老屋裡的生活影像'))) + '</h2><p>' + esc(home?conf.intro:(about.filmText || ui('lifeFilmHint','活動、相遇與地方日常，從這裡慢慢看見。滑動照片可瀏覽，點照片可放大。'))) + '</p></div><button type="button" class="life-film-toggle btn" aria-controls="lifeFilmViewport" aria-pressed="false">' + esc(ui('lifeFilmPlay','播放影像帶')) + '</button></div>' +
      '<div class="life-film-viewport" id="lifeFilmViewport" tabindex="0" role="region" aria-label="' + esc(ui('lifeFilmGallery','可橫向滑動的生活照片')) + '"><div class="life-film-track">' + group(false) + group(true) + '</div></div></section>';
  }

  function initLifeFilm() {
    var film = $('.life-film'); if (!film) return;
    var viewport = $('.life-film-viewport',film), track = $('.life-film-track',film), button = $('.life-film-toggle',film);
    var reduce = window.matchMedia('(prefers-reduced-motion: reduce)'), fine = window.matchMedia('(pointer: fine)');
    var group = $('.life-film-group',film), count = $$('figure',group).length;
    var seconds = Number((C.aboutPage || {}).filmSeconds) || count * 6;
    film.style.setProperty('--film-duration',Math.max(20,Math.min(600,seconds)) + 's');
    function setPlaying(on) {
      on = on && !reduce.matches;
      var offset = null;
      if (!on && film.classList.contains('is-running')) {
        var matrix = /^matrix\(([^)]+)\)$/.exec(window.getComputedStyle(track).transform);
        if (matrix) offset = -parseFloat(matrix[1].split(',')[4]) % group.scrollWidth;
      }
      if (on) viewport.scrollLeft = 0;
      film.classList.toggle('is-running',on);
      if (offset !== null) viewport.scrollLeft = offset;
      button.setAttribute('aria-pressed',on ? 'true' : 'false');
      button.textContent = on ? ui('lifeFilmPause','暫停影像帶') : ui('lifeFilmPlay','播放影像帶');
      button.disabled = reduce.matches;
    }
    button.addEventListener('click',function () { setPlaying(!film.classList.contains('is-running')); });
    viewport.addEventListener('pointerdown',function (e) { if (e.pointerType !== 'mouse') setPlaying(false); },{passive:true});
    viewport.addEventListener('click',function (e) { if (e.target.closest('img[data-full]')) setPlaying(false); });
    viewport.addEventListener('keydown',function (e) { if ((e.key === 'Enter' || e.key === ' ') && e.target.matches('img[data-full]')) { e.preventDefault(); e.target.click(); } });
    viewport.addEventListener('keydown',function (e) {
      if (['ArrowLeft','ArrowRight','Home','End'].indexOf(e.key) < 0) return;
      setPlaying(false);
      if (e.key === 'ArrowLeft' || e.key === 'ArrowRight') { e.preventDefault(); viewport.scrollBy({left:e.key === 'ArrowRight' ? 280 : -280,behavior:'auto'}); }
    });
    function changed() { setPlaying(fine.matches && !reduce.matches); }
    if (reduce.addEventListener) reduce.addEventListener('change',changed);
    changed();
  }

  function initServiceReveal() {
    if ((C.motion || {}).serviceReveal === false || !window.IntersectionObserver || window.matchMedia('(prefers-reduced-motion: reduce)').matches) return;
    var rows = $$('.culture-service-card:not(.service-reveal-ready)');
    if (!rows.length) return;
    var observer = new IntersectionObserver(function (entries) {
      entries.forEach(function (entry) {
        if (!entry.isIntersecting) return;
        entry.target.classList.add('is-revealed'); observer.unobserve(entry.target);
      });
    },{threshold:.08,rootMargin:'0px 0px -30px 0px'});
    rows.forEach(function (row) { row.classList.add('service-reveal-ready'); observer.observe(row); });
  }

  function renderAbout() {
    var about=C.aboutPage||{}, photos=aboutVisualHtml();
    setTitle(about.title||ui('aboutTitle','關於我們'));
    view.innerHTML='<article class="wrap art about-page"><a class="back" href="./">'+esc(ui('backHome','回到首頁'))+'</a><header class="list-head"><h1>'+esc(about.title||ui('aboutTitle','關於我們'))+'</h1></header>'+
      '<div'+(photos?' class="about-story-grid"':'')+'>'+photos+'<div class="prose">'+clean(about.body||'')+'</div></div>'+aboutMilestonesHtml()+lifeFilmHtml()+'</article>';
    initLifeFilm();
  }

  function tagCloudHtml(tags) {
    var label = ui('tagCloudTitle','依主題探索');
    if (tags === null) return '<p class="tag-cloud-note">' + esc(ui('tagCloudUnavailable','標籤暫時無法讀取，仍可從下方文章總表瀏覽。')) + '</p>';
    var list = (tags || []).filter(function (x) { return x.count > 0; }).sort(function (a,b) { return b.count - a.count || text(a.name).localeCompare(text(b.name),'zh-Hant'); });
    if (!list.length) return '';
    var max = Math.max.apply(null,list.map(function (x) { return x.count; }));
    function links(items) { return items.map(function (x) {
      var name = text(x.name), size = 14 + Math.round(10 * Math.log(1 + x.count) / Math.log(1 + max));
      return '<a href="' + esc(q({tag:decodeSlug(x.slug)})) + '" style="font-size:' + size + 'px" aria-label="' + esc(template(ui('tagCloudCount','{name}，{count} 篇文章'),{name:name,count:x.count})) + '">' + esc(name) + '</a>';
    }).join(''); }
    var limit = 45;
    return '<section class="tag-cloud-section" aria-labelledby="tagCloudTitle"><h2 id="tagCloudTitle">' + esc(label) + '</h2><nav class="tag-cloud" aria-label="' + esc(label) + '">' + links(list.slice(0,limit)) + '</nav>' +
      (list.length > limit ? '<details class="tag-cloud-more"><summary>' + esc(template(ui('moreTags','展開其他標籤（{count} 個）'),{count:list.length-limit})) + '</summary><nav class="tag-cloud" aria-label="' + esc(label) + '">' + links(list.slice(limit)) + '</nav></details>' : '') + '</section>';
  }

  function renderArchives() {
    setTitle(ui('allPosts','所有文章'));
    Promise.all([allPages('posts', { _fields: 'id,date,title,categories,excerpt' }), categoriesP, allPages('tags', { _fields:'id,name,slug,count' }).catch(function () { return null; })]).then(function (r) {
      var posts = hideImported(r[0]), cats = r[1];
      var years = {}, order = [];
      posts.forEach(function (p) {
        var y = p.date.slice(0, 4);
        if (!years[y]) { years[y] = []; order.push(y); }
        years[y].push(p);
      });
      view.innerHTML = '<div class="wrap list-page"><header class="list-head"><h1>' + esc(ui('allPosts','所有文章')) + '</h1><p>' + esc(template(ui('archivesIntro','共 {count} 篇，由新到舊排列。'),{count:posts.length})) + '</p>' +
        '<nav class="arch-cats" aria-label="分類">' + cats.filter(function (c) { return c.count > 0; }).sort(function (a, b) { return b.count - a.count; })
          .map(function (c) { return '<a href="' + catUrl(c) + '">' + esc(c.name) + '（' + c.count + '）</a>'; }).join('') + '</nav>' + tagCloudHtml(r[2]) + '</header>' +
        order.map(function (y) {
          return '<section class="arch-year" aria-labelledby="y' + y + '"><h2 id="y' + y + '">' + y + '</h2><ul class="arch-list">' +
            years[y].map(function (p) {
              var c = catsById(p.categories, cats)[0];
              return '<li><time datetime="' + esc(p.date) + '">' + p.date.slice(5, 10).replace('-', '.') + '</time><div><a class="archive-title" href="' + postUrl(p) + '">' + esc(title(p)) + '</a>' + (excerpt(p) ? '<p class="archive-summary">' + esc(excerpt(p)) + '</p>' : '') + '</div><span>' + (c ? esc(c.name) : '') + '</span></li>';
            }).join('') + '</ul></section>';
        }).join('') + '</div>';
    }).catch(function (e) { showError(e); });
  }

  /* ---------- 互動：照片、選單、分享、門 ---------- */

  function bindInteractions() {
    // 照片載入成功蓋掉花磚底紋；失敗就保留底紋
    document.addEventListener('load', function (e) {
      var t = e.target;
      if (t.tagName === 'IMG' && t.getAttribute('data-ph')) t.parentNode.classList.add('has-img');
    }, true);
    document.addEventListener('error', function (e) {
      var t = e.target;
      if (t.tagName === 'IMG' && t.getAttribute('data-ph')) t.remove();
    }, true);

    document.addEventListener('click', function (e) {
      // 子選單：點外面收起
      $$('.nav details').forEach(function (d) { if (!d.contains(e.target)) d.open = false; });
      // 複製連結
      var b = e.target.closest && e.target.closest('[data-copy]');
      if (b) {
        var link = b.getAttribute('data-copy');
        var done = function () { b.textContent = ui('copyDone','已複製連結'); setTimeout(function () { b.textContent = ui('copyLink','複製連結'); }, 2400); };
        if (navigator.share && window.matchMedia('(pointer:coarse)').matches) navigator.share({ url: link, title: document.title }).catch(function () {});
        else if (navigator.clipboard) navigator.clipboard.writeText(link).then(done, function () { window.prompt('複製這個連結：', link); });
        else window.prompt('複製這個連結：', link);
      }
    });
    // 影片：點縮圖才載入 YouTube 播放器，頁面比較快
    document.addEventListener('click', function (e) {
      var v = e.target.closest && e.target.closest('[data-yt]');
      if (!v) return;
      var f = document.createElement('iframe');
      f.src = 'https://www.youtube-nocookie.com/embed/' + v.getAttribute('data-yt') + '?autoplay=1&rel=0';
      f.title = v.getAttribute('aria-label') || '影片';
      f.allow = 'autoplay; encrypted-media; picture-in-picture; fullscreen';
      f.allowFullscreen = true;
      v.replaceWith(f);
    });
    document.addEventListener('keydown', function (e) {
      if (e.key === 'Escape') $$('.nav details').forEach(function (d) { d.open = false; });
    });

    // 放大生活影像時，只輪播該圖集；其他內文照片維持手動瀏覽。
    var box = $('#lightbox'), big = box.querySelector('img'), list = [], idx = 0;
    var playButton = $('[data-lb="play"]',box), counter = $('#lbCount'), caption = $('#lbCaption');
    var playing = false, filmMode = false, modalTimer = null, touchStart = null;
    var reduced = window.matchMedia('(prefers-reduced-motion: reduce)');
    function clearModalTimer() { clearTimeout(modalTimer); modalTimer = null; }
    function updatePlayButton() {
      playButton.hidden = !filmMode || list.length < 2;
      playButton.textContent = playing ? '暫停輪播' : '播放輪播';
      playButton.setAttribute('aria-pressed',playing ? 'true' : 'false');
    }
    function queueNext() {
      clearModalTimer();
      if (!box.open || !playing || document.hidden || list.length < 2) return;
      modalTimer = setTimeout(function() { show(idx+1); },4000);
    }
    function setModalPlaying(on) {
      playing = !!on && filmMode && list.length > 1;
      updatePlayButton();
      clearModalTimer();
      if (big.complete) queueNext();
    }
    function show(i) {
      if (!list.length) return;
      clearModalTimer();
      idx = (i + list.length) % list.length;
      var selected = list[idx], figure = selected.closest('figure'), text = figure && $('figcaption',figure);
      big.alt = selected.alt || selected.getAttribute('aria-label') || '';
      counter.textContent = (idx+1) + ' / ' + list.length;
      caption.textContent = text && text.textContent || big.alt;
      big.onload = queueNext;
      big.onerror = function() { caption.textContent = '此照片暫時無法載入，可切換下一張。'; queueNext(); };
      big.src = selected.getAttribute('data-full');
      if (big.complete) queueNext();
    }
    document.addEventListener('click', function(e) {
      var image = e.target.closest && e.target.closest('.prose img[data-full],.life-film img[data-full],.about-photo-button[data-full]');
      if (!image || !box.showModal) return;
      e.preventDefault();
      var film = image.closest('.life-film');
      filmMode = !!film;
      list = film ? $$('.life-film-group:not([aria-hidden=true]) img[data-full]',film) : $$('.prose img[data-full],.about-photo-button[data-full]');
      var position = list.indexOf(image);
      if (position < 0) position = list.map(function(x) {return x.getAttribute('data-full');}).indexOf(image.getAttribute('data-full'));
      if (position < 0) return;
      playing = false;
      show(position);
      if (!box.open) box.showModal();
      setModalPlaying(filmMode && !reduced.matches);
    });
    box.addEventListener('click',function(e) {
      var button = e.target.closest('[data-lb]'), action = button && button.getAttribute('data-lb');
      if (action === 'prev') show(idx-1);
      else if (action === 'next') show(idx+1);
      else if (action === 'play') setModalPlaying(!playing);
      else if (action === 'close' || e.target === box) box.close();
    });
    box.addEventListener('keydown',function(e) {
      if (e.key === 'ArrowLeft' || e.key === 'ArrowRight') {e.preventDefault();show(idx+(e.key==='ArrowLeft'?-1:1));}
      if ((e.key === ' ' || e.key === 'Spacebar') && (e.target === box || e.target === big)) {e.preventDefault();setModalPlaying(!playing);}
    });
    big.addEventListener('pointerdown',function(e) {touchStart=e.pointerType==='touch'?{x:e.clientX,y:e.clientY}:null;});
    big.addEventListener('pointerup',function(e) {
      if(!touchStart)return;var dx=e.clientX-touchStart.x,dy=e.clientY-touchStart.y;touchStart=null;
      if(Math.abs(dx)>45 && Math.abs(dy)<70)show(idx+(dx<0?1:-1));
    });
    box.addEventListener('close',function() {
      playing=false;clearModalTimer();updatePlayButton();touchStart=null;
      big.onload=big.onerror=null;
    });
    document.addEventListener('visibilitychange',function() {if(document.hidden)clearModalTimer();else if(box.open&&big.complete)queueNext();});
    if(reduced.addEventListener)reduced.addEventListener('change',function() {if(reduced.matches)setModalPlaying(false);});

  }

  /* ---------- 依網址決定顯示哪一頁 ---------- */

  // 已經用管理程式搬過來的 WordPress 頁面，舊連結改顯示新頁面
  function importedTarget(idOrSlug) {
    var hit = function (x) { return x && (String(x.wpId) === idOrSlug || (x.wpSlug && decodeSlug(x.wpSlug) === idOrSlug)); };
    if (C.aboutPage && hit(C.aboutPage)) return renderAbout;
    var issue = shown(D.shanhaiji).filter(hit)[0];
    if (issue) return function () { renderIssueDetail(issue.slug || issue.title); };
    var m = shown(D.media).filter(hit)[0];
    if (m) return function () { renderMediaDetail(m.slug || m.title); };
    var s = shown(D.services).filter(hit)[0];
    if (s) return function () { renderDetail('service', s.slug || s.title); };
    var t = shown(D.towns).filter(hit)[0];
    if (t) return function () { renderDetail('town', t.slug || t.title); };
    if ((D.site.importedVideoPages || []).some(function (p) { return String(p.id) === idOrSlug || decodeSlug(p.slug || '') === idOrSlug; })) return renderVideos;
    return null;
  }

function bookingEntry(svc) { return q({view:'booking',item:svc ? (svc.slug || svc.title) : ''}); }
  function bookingMessage(svc) {
    return template(ui('bookingMessage','您好，我想詢問「{service}」的預約安排。'),{service:svc ? svc.title : ui('bookingGeneral','團體到訪')});
  }
  // 首頁、服務頁及獨立詢問頁共用，欄位與聯絡內容保持一致。
  function bookingFormHtml(chosen, prefix) {
    var list=shown(D.services), V=C.visit, id=prefix||'booking';
    return '<div class="booking-choice" data-booking-choice>'+
      '<label for="'+id+'Service">'+esc(ui('bookingService','想了解的服務'))+'</label>'+
      '<select id="'+id+'Service" data-booking-service><option value="">'+esc(ui('bookingGeneral','團體到訪'))+'</option>'+list.map(function(s){return '<option value="'+esc(s.slug||s.title)+'"'+(chosen&&(chosen.slug||chosen.title)===(s.slug||s.title)?' selected':'')+'>'+esc(s.title)+'</option>';}).join('')+'</select>'+
      '<label for="'+id+'Message">'+esc(ui('bookingMessageLabel','詢問內容'))+'</label>'+
      '<textarea id="'+id+'Message" data-booking-message class="booking-message" rows="5" maxlength="4000" aria-describedby="'+id+'Hint">'+esc(bookingMessage(chosen))+'</textarea>'+
      '<p class="booking-input-hint" id="'+id+'Hint">'+esc(ui('bookingServiceHint','可直接修改上方內容，填寫希望的日期、人數與其他需求。'))+'</p><div class="booking-channel">'+
      (V.line?'<a class="btn" data-booking-line href="'+esc(lineHref(chosen||{title:ui('bookingGeneral','團體到訪')}))+'">'+esc(ui('bookingLine','帶入項目，用 LINE 詢問'))+'</a>':'')+
      (V.email?'<a class="btn ghost" data-booking-email href="mailto:'+esc(V.email)+'">'+esc(ui('bookingEmail','帶入項目，用 Email 詢問'))+'</a>':'')+
      (V.facebookUrl?'<a class="btn ghost" href="'+esc(ContentSettings.linkPath(V.facebookUrl))+'" target="_blank" rel="noopener noreferrer">'+esc(ui('facebook','Facebook 私訊'))+'</a>':'')+
      '<a class="btn ghost" data-booking-form hidden target="_blank" rel="noopener noreferrer">'+esc(ui('bookOnline','線上預約'))+'</a>'+
      (V.phone?'<a class="more" href="tel:'+esc(V.phone.replace(/[^\d+]/g,''))+'">'+esc(ui('phone','打電話'))+' '+esc(V.phone)+'</a>':'')+
      '</div><p class="booking-help">'+esc(ui('bookingHelp','LINE 與 Email 會預填詢問內容；Facebook 請自行貼上需求。訊息仍需由你送出，日期與名額以協會回覆確認為準。'))+'</p></div>';
  }

  function initBookingForms() {
    document.querySelectorAll('[data-booking-choice]').forEach(function(box){
      if(box.getAttribute('data-booking-ready')) return;
      box.setAttribute('data-booking-ready','true');
      var list=shown(D.services), V=C.visit;
      var serviceField=box.querySelector('[data-booking-service]'), messageField=box.querySelector('[data-booking-message]');
      var generatedMessage=bookingMessage(findBy(list,serviceField.value));
      function sync() {
        var svc=findBy(list,serviceField.value), message=messageField.value;
        var line=box.querySelector('[data-booking-line]'), email=box.querySelector('[data-booking-email]'), form=box.querySelector('[data-booking-form]'), book=bookingUrl(svc);
        if(line) {
          var href=lineHref(svc||{title:ui('bookingGeneral','團體到訪')});
          line.href=/^https:\/\/line\.me\/R\/oaMessage\//i.test(href) ? href.split('?')[0].replace(/\/$/,'')+'/?'+encodeURIComponent(message) : href;
        }
        if(email) email.href='mailto:'+V.email+'?subject='+encodeURIComponent('預約詢問：'+(svc?svc.title:ui('bookingGeneral','團體到訪')))+'&body='+encodeURIComponent(message);
        if(form) {form.hidden=!book; if(book)form.href=book; else form.removeAttribute('href');}
      }
      serviceField.addEventListener('change',function(){
        var next=bookingMessage(findBy(list,serviceField.value));
        if(messageField.value===generatedMessage) messageField.value=next;
        generatedMessage=next;
        sync();
      });
      messageField.addEventListener('input',sync);
      sync();
    });
  }

  function renderBooking() {
    var chosen=findBy(shown(D.services),params.get('item') || '');
    setTitle(ui('bookingTitle','預約與詢問'));
    view.innerHTML='<section class="wrap booking-page"><a class="back" href="?view=services">'+esc(ui('allServices','所有服務'))+'</a>'+
      '<header class="list-head"><h1>'+esc(ui('bookingTitle','預約與詢問'))+'</h1><p>'+esc(ui('bookingIntro','選擇想了解的服務，並在下方填寫詢問內容，我們會和你確認日期、人數及安排。'))+'</p></header>'+
      bookingFormHtml(chosen,'booking')+'</section>';
    initBookingForms();
  }

  function aboutVisualHtml() {
    var a=C.aboutPage||{}, photos=(a.featurePhotos||[]).filter(function(p){return p.image;}).slice(0,3);
    if (a.featureShow===false || !photos.length) return '';
    return '<div class="about-photo-set">'+photos.map(function(p,i){var src=img(p.image,1400);return '<figure'+(i===0?' class="about-main-photo"':'')+'><button type="button" class="about-photo-button" data-about-photo data-full="'+esc(src)+'" aria-label="'+esc((p.caption||p.alt||ui('viewPhoto','放大照片')))+'"><img data-full="'+esc(src)+'" src="'+esc(src)+'" alt="'+esc(p.alt||'')+'" loading="'+(i===0?'eager':'lazy')+'"></button>'+(p.caption?'<figcaption>'+esc(p.caption)+'</figcaption>':'')+'</figure>';}).join('')+'</div>';
  }
  function aboutMilestonesHtml() {
    var a=C.aboutPage||{}, rows=(a.milestones||[]).filter(function(m){return m.year||m.title;});
    if(a.milestonesShow===false||!rows.length) return '';
    return '<section class="about-history" aria-labelledby="historyTitle"><h2 id="historyTitle">'+esc(a.milestonesTitle||ui('historyTitle','老屋的時間印記'))+'</h2><div class="history-cards">'+rows.map(function(m){
      var href=ContentSettings.linkPath(m.href||''),src=img(m.image,1600),label=m.year+'：閱讀'+(m.title||'相關故事');
      var photo=src?'<figure class="history-photo"><'+(href?'a href="'+esc(href)+'" aria-label="'+esc(label)+'"':'div')+' class="history-photo-frame"><img src="'+esc(src)+'" alt="'+esc(m.alt||m.title||'')+'" loading="lazy" decoding="async"></'+(href?'a':'div')+'>'+(m.caption?'<figcaption>'+esc(m.caption)+'</figcaption>':'')+'</figure>':'';
      return '<article class="history-card'+(src?' has-photo':'')+'">'+photo+'<div class="history-copy"><p class="history-year">'+(href?'<a href="'+esc(href)+'" aria-label="'+esc(label)+'">'+esc(m.year)+'</a>':esc(m.year))+'</p><h3>'+esc(m.title)+'</h3><p>'+esc(m.text||'')+'</p></div></article>';
    }).join('')+'</div></section>';
  }

  function route() {
    var g = function (k) { return (params.get(k) || '').trim(); };
    if (g('view') === 'booking') return renderBooking();
    if (g('view') === 'about') return renderAbout();
    if (g('service')) return renderDetail('service', g('service'));
    if (g('town')) return renderDetail('town', g('town'));
    if (g('view') === 'services') return renderIndex('services');
    if (g('view') === 'towns') return renderIndex('towns');
    if (g('view') === 'videos') return renderVideos();
    if (g('view') === 'shanhaiji') { setTitle('山海集'); view.innerHTML = shanhaijiHtml(sectionConf('shanhaiji')); return; }
    if (g('issue')) return renderIssueDetail(g('issue'));
    if (g('media')) return renderMediaDetail(g('media'));
    if (g('view') === 'media') return renderMediaIndex();
    var post = g('p') || g('name');
    if (post) { var mt = importedTarget(post); return mt ? mt() : renderPost(post); }
    var pg = g('page_id') || g('pagename').split('/').filter(Boolean).pop();
    if (pg) { var imp = importedTarget(pg); return imp ? imp() : renderPage(pg); }
    if (g('cat')) return renderCategory(g('cat'));
    if (g('category_name')) return renderCategory(g('category_name').split('/').filter(Boolean).pop());
    if (g('tag')) return renderTag(g('tag'));
    if (params.has('s')) return renderSearch(g('s'));
    if (g('view') === 'search') return renderSearch('');
    if (g('view') === 'archives') return renderArchives();
    if (g('view') === 'posts' || g('paged')) return renderList({ title: '所有文章', showFilter: true, keep: { view: 'posts' } });
    renderHome();
  }

  // 首頁精簡版（版面第 2 版）：服務為主，其他內容收進「探索更多」。管理程式發布後會把這個設定存起來
  function migrateLayout(s) {
    if ((s.layoutVersion || 1) === 2) {
      // 第 3 版：首頁最上面加一段開場短文
      if (!s.sections.some(function (x) { return x.key === 'about'; })) s.sections.unshift({ key: 'about', show: true, title: '關於番社參拾', intro: '' });
      s.layoutVersion = 3;
      return;
    }
    if ((s.layoutVersion || 1) >= 3) return;
    var old = {};
    (s.sections || []).forEach(function (x) { old[x.key] = x; });
    var def = [
      ['services', true, '協會的服務', '以陳家古厝為據點，提供導覽、展覽、課程與市集。'],
      ['booking', true, '預約與詢問', '團體導覽與手作課程請先預約。'],
      ['events', true, '近期活動', ''],
      ['explore', true, '探索更多', ''],
      ['posts', false, '活動紀錄與在地觀察', ''], ['media', false, '媒體報導', ''], ['towns', false, '小鎮社區人文', ''],
      ['shanhaiji', false, '《山海集》', ''], ['videos', false, '影片精選', ''], ['visit', false, '到訪陳家古厝', ''],
    ];
    s.sections = def.map(function (d) {
      var o = old[d[0]] || {};
      var x = { key: d[0], show: d[1], title: o.title || d[2], intro: o.intro != null && o.intro !== '' ? o.intro : d[3] };
      if (d[0] === 'media') x.count = o.count || 3;
      return x;
    });
    s.layoutVersion = 2;
    migrateLayout(s);
  }

  // 讀取 data/ 資料夾。cache: 'no-cache' 讓瀏覽器每次都確認有沒有新版本，管理程式發布後很快就看得到
  function loadData() {
    var get = function (name) {
      return fetch('data/' + name + '.json', { cache: 'no-cache' }).then(function (r) {
        if (!r.ok) throw new Error(name + '.json HTTP ' + r.status);
        return r.json();
      });
    };
    var names = ['site', 'services', 'towns', 'videos', 'events', 'media', 'shanhaiji'];
    return Promise.all(names.map(function (n) {
      return get(n).catch(function (e) { if (n === 'site') throw e; console.warn(e); return []; });
    })).then(function (r) { names.forEach(function (n, i) { D[n] = r[i]; }); });
  }

  // Keep an already-open page correct when a closure begins or ends.
  setInterval(function () { if (C && C.visit) updateOpenStatus(); }, 30000);
  document.addEventListener('visibilitychange', function () { if (!document.hidden && C && C.visit) updateOpenStatus(); });
  bindInteractions();
  bindDesktopLineContact();
  if (!window.fetch || !window.Promise) {
    view.innerHTML = '<div class="wrap err"><h1>瀏覽器版本太舊</h1><p>請更新瀏覽器後再開啟。</p></div>';
    return;
  }
  loading();
  loadData().then(function () {
    C = D.site; ContentSettings.applyDefaults(C);
    ContentSettings.normalizeData(D);
    C.sections = C.sections || [];
    migrateLayout(C);
    ensureFeaturedSection(C);
    ensureOpeningIntro(C);
    ensureLifeFilmSection(C);
    if (shown(D.media).length && !C.sections.some(function (x) { return x.key === 'media'; })) {
      var at = C.sections.map(function (x) { return x.key; }).indexOf('posts') + 1;
      C.sections.splice(at || C.sections.length, 0, { key: 'media', show: true, title: '媒體報導', intro: '', count: 3 });
    }
    API = 'https://public-api.wordpress.com/wp/v2/sites/' + C.wordpressSite;
    OLD_HOSTS = [C.wordpressSite.toLowerCase()];
    startWordPress();
    renderChrome();
    route();
  }).catch(function (e) {
    console.error(e);
    view.innerHTML = '<div class="wrap err"><h1>網站資料讀取失敗</h1><p>請稍後重新整理。若一直出現這個畫面，可能是 data/site.json 格式有誤，請到管理程式的「版本紀錄」還原上一個版本。</p></div>';
  });
})();





























// Responsive stacked photo mosaic; generated styles are never stored as article content.
(function(){
 var pending=false, observed=new WeakSet();
 var ro=window.ResizeObserver?new ResizeObserver(schedule):null;
 function set(el,key,value){if(key.indexOf('--')===0){if(el.style.getPropertyValue(key)!==value)el.style.setProperty(key,value);}else if(el.style[key]!==value)el.style[key]=value;}
 function layout(){pending=false;document.querySelectorAll('[data-image-columns="mosaic"]').forEach(function(album){
  if(ro&&!observed.has(album)){ro.observe(album);observed.add(album);}
  var width=album.clientWidth;if(!width)return;
  var photos=Array.from(album.children).filter(function(f){return f.tagName==='FIGURE';}).map(function(f){var im=f.querySelector('img');return {f:f,r:im&&im.naturalWidth?Math.max(.15,Math.min(8,im.naturalWidth/im.naturalHeight)):1.4,caption:0};});
  var gap=Number(album.getAttribute('data-image-gap'))||8,top=0;
  for(var start=0;start<photos.length;){
   var count=Math.min(width<480?4:6,photos.length-start), sizes=count===6?[2,1,2,1]:count===5?[2,1,2]:count===4?(width<480?[2,2]:[1,2,1]):count===3?[1,2]:count===2?[1,1]:[1];
   var columns=[],index=start;
   sizes.forEach(function(n){columns.push(photos.slice(index,index+n));index+=n;});
   var height=0,widths=[];
   // Caption measurements participate in the same column-height calculation.
   for(var pass=0;pass<4;pass++){
    var denominator=0,extra=0;
    columns.forEach(function(col){var inv=col.reduce(function(a,x){return a+1/x.r;},0),c=col.reduce(function(a,x){return a+x.caption;},0)+gap*(col.length-1);denominator+=1/inv;extra+=c/inv;});
    height=(width-gap*(columns.length-1)+extra)/denominator;
    widths=columns.map(function(col){var inv=col.reduce(function(a,x){return a+1/x.r;},0),c=col.reduce(function(a,x){return a+x.caption;},0)+gap*(col.length-1);return Math.max(1,(height-c)/inv);});
    columns.forEach(function(col,i){col.forEach(function(x){set(x.f,'--mosaic-width',widths[i].toFixed(3)+'px');var cap=x.f.querySelector('figcaption');x.caption=cap?cap.getBoundingClientRect().height+parseFloat(getComputedStyle(cap).marginTop||0)+parseFloat(getComputedStyle(cap).marginBottom||0):0;});});
   }
   var left=0,bottom=top;
   columns.forEach(function(col,i){var y=top;col.forEach(function(x){set(x.f,'left',left.toFixed(3)+'px');set(x.f,'top',y.toFixed(3)+'px');y+=widths[i]/x.r+x.caption+gap;});bottom=Math.max(bottom,y-gap);left+=widths[i]+gap;});
   top=bottom+gap;start+=count;
  }
  set(album,'height',Math.max(0,top-gap).toFixed(3)+'px');
 });}
 function schedule(){if(!pending){pending=true;requestAnimationFrame(layout);}}
 document.addEventListener('load',function(e){if(e.target.tagName==='IMG')schedule();},true);
 window.addEventListener('resize',schedule);
 new MutationObserver(function(records){records.forEach(function(record){if(record.type==='attributes'&&record.attributeName==='data-image-columns'&&record.target.getAttribute('data-image-columns')!=='mosaic'){record.target.style.removeProperty('height');Array.from(record.target.children).forEach(function(f){['left','top','width','flex-basis'].forEach(function(k){f.style.removeProperty(k);});});}});schedule();}).observe(document.documentElement,{childList:true,subtree:true,characterData:true,attributes:true,attributeFilter:['src','data-image-columns','data-image-gap','hidden','class']});
 if(document.fonts)document.fonts.ready.then(schedule);
 schedule();
})();


