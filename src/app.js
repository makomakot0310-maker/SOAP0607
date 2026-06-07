/* --------------------------------------------------
   音声入力SOAPノート - アプリケーションロジック
-------------------------------------------------- */

document.addEventListener('DOMContentLoaded', () => {
  // DOM要素の取得
  const btnStart = document.getElementById('btn-start');
  const btnStop = document.getElementById('btn-stop');
  const btnClear = document.getElementById('btn-clear');
  const btnDemo = document.getElementById('btn-demo');
  const btnConvert = document.getElementById('btn-convert');
  const btnCopyAll = document.getElementById('btn-copy-all');
  
  const rawTextarea = document.getElementById('raw-text');
  const realtimePreview = document.getElementById('realtime-preview');
  const recordingStatus = document.getElementById('recording-status');
  const waveContainer = document.getElementById('wave-container');
  const toast = document.getElementById('toast');

  // SOAP出力エリア
  const soapSContent = document.getElementById('soap-s-content');
  const soapOContent = document.getElementById('soap-o-content');
  const soapAContent = document.getElementById('soap-a-content');
  const soapPContent = document.getElementById('soap-p-content');
  const soapUContent = document.getElementById('soap-u-content');

  // 音声認識オブジェクト
  let recognition = null;
  let isRecording = false;
  let finalTranscriptAccumulator = ''; // 確定したテキストの蓄積用

  // SOAP分類ルール用のキーワード
  const keywords = {
    S: ['痛い', 'つらい', 'しびれる', 'だるい', '動かしにくい', '不安', '眠れない', '訴え', '気持ち', 'かゆい', '苦しい', '言っている', '話す', 'きつい', 'しんどい', '主訴', '不快', '痛む', '凝り', 'はり', '張る'],
    O: ['rom', 'mmt', '度', 'cm', 'kg', 'mmhg', '秒', '歩行', '握力', 'バイタル', '腫脹', '熱感', '発赤', '血圧', '脈拍', '体温', '測定', '検査', '観察', '拍', '％', '%', '腫れ', '赤み', '屈曲', '伸展', '進展', '外転', '内転', '回旋', '背屈', '底屈', '掌屈', '立位', '座位', '臥位', '歩行器', '独歩', '杖', '装具', '介助', '自立', '監視', '麻痺', '筋力', '可動域', 'テスト', '脈', 'サチュレーション', 'spo2', '酸素', '心拍'],
    A: ['考えられる', '原因', '問題', '改善', '低下', '制限', 'リスク', '評価', '予測', '考察', '分析', '影響', 'ため', '状態', '推測', '疑い', 'アセスメント', '見込み', '困難', '維持', '向上', '良好', '遅延', '阻害', '不十分'],
    P: ['プログラム', '目標', '実施', '継続', '指導', '週', 'セット', '退院', '自主トレ', '予定', '計画', 'アプローチ', '進める', '行う', 'トレーニング', '訓練', 'エクササイズ', '処方', 'メニュー', '指導', 'アドバイス', '提案', '調整', '設定', '様子見', '経過観察', 'romex', '筋トレ']
  };

  // Lucideアイコンの初期化
  if (typeof lucide !== 'undefined') {
    lucide.createIcons();
  }

  // 1. 音声認識 (Web Speech API) の初期化
  const initSpeechRecognition = () => {
    const SpeechRecognition = window.SpeechRecognition || window.webkitSpeechRecognition;
    if (!SpeechRecognition) {
      alert('お使いのブラウザはWeb Speech API（音声認識）に対応していません。Google ChromeやMicrosoft Edgeなどの対応ブラウザをご使用ください。');
      btnStart.disabled = true;
      return null;
    }

    const rec = new SpeechRecognition();
    rec.lang = 'ja-JP';
    rec.continuous = true;
    rec.interimResults = true;

    // 音声認識開始時
    rec.onstart = () => {
      isRecording = true;
      btnStart.disabled = true;
      btnStop.disabled = false;
      recordingStatus.style.display = 'flex';
      waveContainer.style.display = 'flex';
      realtimePreview.textContent = '話しかけてください...';
    };

    // 音声認識エラー時
    rec.onerror = (event) => {
      console.error('Speech recognition error:', event.error);
      if (event.error === 'not-allowed') {
        alert('マイクの使用が許可されていません。ブラウザの設定でマイクへのアクセスを許可してください。');
      } else if (event.error !== 'no-speech') {
        showToast(`音声認識エラー: ${event.error}`);
      }
    };

    // 音声認識終了時
    rec.onend = () => {
      // ユーザーが停止ボタンを押さずに、何らかの理由（一時的な無音など）で自動停止した場合は再起動する
      if (isRecording) {
        try {
          recognition.start();
        } catch (e) {
          console.error('Failed to restart recognition:', e);
          resetRecordingUI();
        }
      } else {
        resetRecordingUI();
      }
    };

    // 音声認識結果受信時
    rec.onresult = (event) => {
      let interimTranscript = '';
      let newFinalTranscript = '';

      for (let i = event.resultIndex; i < event.results.length; ++i) {
        const result = event.results[i];
        if (result.isFinal) {
          newFinalTranscript += result[0].transcript;
        } else {
          interimTranscript += result[0].transcript;
        }
      }

      // 確定したテキストがある場合、テキストエリアに追加
      if (newFinalTranscript) {
        // 末尾に句読点がない場合は「。」を付与する（文分割をしやすくするため）
        let formattedText = newFinalTranscript.trim();
        if (formattedText && !/[。！？]$/.test(formattedText)) {
          formattedText += '。';
        }
        
        const currentText = rawTextarea.value;
        if (currentText.length > 0 && !currentText.endsWith('\n') && !currentText.endsWith(' ')) {
          rawTextarea.value = currentText + ' ' + formattedText;
        } else {
          rawTextarea.value = currentText + formattedText;
        }
        
        // テキストエリアを最下部までスクロール
        rawTextarea.scrollTop = rawTextarea.scrollHeight;
      }

      // 認識中のテキストをプレビューエリアに表示
      if (interimTranscript) {
        realtimePreview.textContent = interimTranscript;
        realtimePreview.style.display = 'block';
      } else {
        realtimePreview.textContent = '';
        realtimePreview.style.display = 'none';
      }
    };

    return rec;
  };

  recognition = initSpeechRecognition();

  // 録音UIのリセット
  const resetRecordingUI = () => {
    isRecording = false;
    btnStart.disabled = false;
    btnStop.disabled = true;
    recordingStatus.style.display = 'none';
    waveContainer.style.display = 'none';
    realtimePreview.textContent = '';
    realtimePreview.style.display = 'none';
  };

  // 2. ボタン操作のイベントリスナー
  
  // 録音開始
  btnStart.addEventListener('click', () => {
    if (!recognition) {
      recognition = initSpeechRecognition();
    }
    if (recognition && !isRecording) {
      // ユーザーの明示的な開始
      finalTranscriptAccumulator = rawTextarea.value;
      try {
        recognition.start();
      } catch (e) {
        console.error('Start recognition failed:', e);
      }
    }
  });

  // 録音停止
  btnStop.addEventListener('click', () => {
    if (recognition && isRecording) {
      isRecording = false; // 先にフラグを倒すことで、onendでの自動再起動を防ぐ
      recognition.stop();
    }
  });

  // クリア
  btnClear.addEventListener('click', () => {
    if (confirm('入力テキストおよびSOAP変換結果をすべて消去しますか？')) {
      rawTextarea.value = '';
      realtimePreview.textContent = '';
      realtimePreview.style.display = 'none';
      if (recognition && isRecording) {
        isRecording = false;
        recognition.stop();
      }
      resetSOAPOutputs();
      showToast('クリアしました');
    }
  });

  // デモテキスト挿入
  btnDemo.addEventListener('click', () => {
    const demoText = `本日は右肩関節の痛みが強いためリハビリに前向きになれないと訴えておられます。
関節可動域測定を行ったところ、右肩関節の屈曲角度は110度、外転角度は90度でした。握力は右が18kg、左が24kgでした。また、肩関節周囲に軽度の熱感と腫脹が観察されます。
肩関節の炎症に伴う疼痛と可動域制限により、ADL動作での自己管理能力の低下が問題と考えられます。
今後は可動域制限のさらなる進行と筋力低下を防ぐため、痛みの出ない範囲での関節可動域訓練を週3回実施し、自宅での自主トレとして振り子運動を1日3セット行うよう指導を継続します。`;
    
    rawTextarea.value = demoText;
    rawTextarea.scrollTop = rawTextarea.scrollHeight;
    showToast('デモテキストを挿入しました');
  });

  // SOAP変換の実行
  btnConvert.addEventListener('click', () => {
    const text = rawTextarea.value.trim();
    if (!text) {
      alert('変換するテキストがありません。音声入力するか、テキストを直接入力してください。');
      return;
    }
    
    processSOAPConversion(text);
  });

  // カテゴリ判定のスコアリングヘルパー
  const judgeCategory = (text) => {
    const lowerText = text.toLowerCase();
    let scoreS = 0;
    let scoreO = 0;
    let scoreA = 0;
    let scoreP = 0;

    keywords.S.forEach(kw => { if (lowerText.includes(kw)) scoreS++; });
    keywords.O.forEach(kw => { if (lowerText.includes(kw)) scoreO++; });
    keywords.A.forEach(kw => { if (lowerText.includes(kw)) scoreA++; });
    keywords.P.forEach(kw => { if (lowerText.includes(kw)) scoreP++; });

    const maxScore = Math.max(scoreS, scoreO, scoreA, scoreP);
    if (maxScore === 0) return 'U';

    if (maxScore === scoreS) return 'S';
    if (maxScore === scoreO) return 'O';
    if (maxScore === scoreA) return 'A';
    return 'P';
  };

  // 3. SOAP変換ロジック
  const processSOAPConversion = (inputText) => {
    // 1. 句読点、改行、全角半角スペースでフラグメントに分割する
    const fragments = inputText
      .split(/[。！？\n　 ]+/)
      .map(s => s.trim())
      .filter(s => s.length > 0);

    // 2. 各フラグメントのカテゴリを判定
    const judged = fragments.map(frag => {
      const cat = judgeCategory(frag);
      return { text: frag, cat: cat };
    });

    // 3. フラグメントの文脈的マージ (細切れ防止)
    const merged = [];
    judged.forEach(item => {
      if (merged.length === 0) {
        merged.push(item);
        return;
      }

      const last = merged[merged.length - 1];

      // マージルール:
      // A. 現在が未分類(U)なら、直前が何であれ直前に結合
      // B. 直前が未分類(U)なら、現在の要素に直前を結合（カテゴリは現在のものに昇格）
      // C. 直前と現在のカテゴリが同じなら結合
      if (item.cat === 'U') {
        last.text += ' ' + item.text;
      } else if (last.cat === 'U') {
        last.text += ' ' + item.text;
        last.cat = item.cat;
      } else if (last.cat === item.cat) {
        last.text += ' ' + item.text;
      } else {
        // カテゴリが異なり、どちらもUでない場合は独立した文とする
        merged.push(item);
      }
    });

    // 分類用の配列を準備
    const soapData = {
      S: [],
      O: [],
      A: [],
      P: [],
      U: [] // 未分類
    };

    // マージされた文をそれぞれのカテゴリに振り分け
    merged.forEach(item => {
      const targetCat = item.cat === 'U' ? 'U' : item.cat;
      if (soapData[targetCat]) {
        soapData[targetCat].push(item.text);
      }
    });

    // 3. UIにレンダリング
    renderSOAPList(soapSContent, soapData.S, '主観的情報（S）がありません');
    renderSOAPList(soapOContent, soapData.O, '客観的情報（O）がありません');
    renderSOAPList(soapAContent, soapData.A, '評価・解釈（A）がありません');
    renderSOAPList(soapPContent, soapData.P, '治療計画（P）がありません');
    renderSOAPList(soapUContent, soapData.U, '未分類の文はありません');

    // 変換完了トースト
    showToast('SOAP変換が完了しました！');

    // 自動スクロールで変換結果へ移動 (モバイル対応)
    const outputPanel = document.querySelector('.output-panel');
    if (outputPanel && window.innerWidth < 1024) {
      outputPanel.scrollIntoView({ behavior: 'smooth' });
    }
  };

  // SOAPリストの描画ヘルパー
  const renderSOAPList = (element, dataList, emptyMsgText) => {
    element.innerHTML = '';
    
    if (dataList.length === 0) {
      const li = document.createElement('li');
      li.className = 'empty-message';
      li.textContent = emptyMsgText;
      element.appendChild(li);
    } else {
      dataList.forEach(item => {
        const li = document.createElement('li');
        // 文末の句点が付いていない場合は補正して綺麗に見せる
        let text = item;
        if (!/[。！？]$/.test(text)) {
          text += '。';
        }
        li.textContent = text;
        element.appendChild(li);
      });
    }
  };

  // SOAP出力エリアの初期化
  const resetSOAPOutputs = () => {
    renderSOAPList(soapSContent, [], '主観的情報（S）がここに表示されます');
    renderSOAPList(soapOContent, [], '客観的情報（O）がここに表示されます');
    renderSOAPList(soapAContent, [], '評価（分析、解釈、制限要因、改善度合い）がここに表示されます');
    renderSOAPList(soapPContent, [], '治療計画（リハビリプログラム、指示事項、指導、次回予定）がここに表示されます');
    renderSOAPList(soapUContent, [], 'どのキーワードにも該当しなかった文がここに表示されます');
  };

  // 4. コピー機能の実装
  
  // トースト表示機能
  const showToast = (message) => {
    toast.textContent = message;
    toast.classList.add('show');
    setTimeout(() => {
      toast.classList.remove('show');
    }, 2500);
  };

  // テキストをクリップボードにコピー
  const copyToClipboard = (text) => {
    if (navigator.clipboard && navigator.clipboard.writeText) {
      navigator.clipboard.writeText(text)
        .then(() => showToast('クリップボードにコピーしました！'))
        .catch(err => {
          console.error('Clipboard copy failed:', err);
          fallbackCopyText(text);
        });
    } else {
      fallbackCopyText(text);
    }
  };

  // コピー用フォールバック
  const fallbackCopyText = (text) => {
    const textArea = document.createElement('textarea');
    textArea.value = text;
    textArea.style.position = 'fixed'; // 画面外に配置
    document.body.appendChild(textArea);
    textArea.focus();
    textArea.select();
    try {
      const successful = document.execCommand('copy');
      if (successful) {
        showToast('クリップボードにコピーしました！');
      } else {
        showToast('コピーに失敗しました');
      }
    } catch (err) {
      console.error('Fallback copy failed:', err);
      showToast('コピーに対応していません');
    }
    document.body.removeChild(textArea);
  };

  // カード個別コピーボタンの制御
  document.querySelectorAll('.btn-copy-card').forEach(button => {
    button.addEventListener('click', (e) => {
      e.stopPropagation();
      const targetId = button.getAttribute('data-target');
      const listElement = document.getElementById(targetId);
      
      if (!listElement) return;

      // リスト内の全テキストを統合（空メッセージは無視）
      const listItems = Array.from(listElement.querySelectorAll('li:not(.empty-message)'));
      if (listItems.length === 0) {
        showToast('コピーするコンテンツがありません');
        return;
      }

      const textToCopy = listItems.map(li => `・${li.textContent}`).join('\n');
      
      // カテゴリ名のプレフィックスを付ける
      let prefix = '';
      if (targetId.includes('soap-s')) prefix = '【S: 主観的情報】\n';
      else if (targetId.includes('soap-o')) prefix = '【O: 客観的情報】\n';
      else if (targetId.includes('soap-a')) prefix = '【A: 評価・解釈】\n';
      else if (targetId.includes('soap-p')) prefix = '【P: 治療計画】\n';
      else if (targetId.includes('soap-u')) prefix = '【未分類】\n';

      copyToClipboard(prefix + textToCopy);
    });
  });

  // 全体コピーボタン
  btnCopyAll.addEventListener('click', () => {
    const sections = [
      { id: 'soap-s-content', name: 'S: 主観的情報' },
      { id: 'soap-o-content', name: 'O: 客観的情報' },
      { id: 'soap-a-content', name: 'A: 評価・解釈' },
      { id: 'soap-p-content', name: 'P: 治療計画' },
      { id: 'soap-u-content', name: '未分類' }
    ];

    let fullText = '';
    let hasContent = false;

    sections.forEach(sec => {
      const listElement = document.getElementById(sec.id);
      if (listElement) {
        const listItems = Array.from(listElement.querySelectorAll('li:not(.empty-message)'));
        if (listItems.length > 0) {
          hasContent = true;
          fullText += `【${sec.name}】\n`;
          fullText += listItems.map(li => `・${li.textContent}`).join('\n');
          fullText += '\n\n';
        }
      }
    });

    if (!hasContent) {
      showToast('コピーするSOAPノートが空です');
      return;
    }

    copyToClipboard(fullText.trim());
  });
});
