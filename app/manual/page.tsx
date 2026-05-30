import Link from "next/link";
import styles from "./manual.module.css";

export default function ManualPage() {
  return (
    <div className={styles.wrap}>
      <h1 className={styles.title}>📖 使い方マニュアル</h1>
      <p className={styles.lead}>
        Hanakotoba の 4 つの機能を、はじめて使う方でもわかるように説明します。
      </p>

      {/* ========== 概要 ========== */}
      <section className={styles.section}>
        <h2 className={styles.sectionTitle}>Hanakotoba とは？</h2>
        <p>
          Hanakotoba（花言葉）は、外国語を話すお客様とのコミュニケーションをサポートする、
          お花屋さん向けの多言語接客ツールです。
          英語・中国語・韓国語など 14 言語に対応しており、スマートフォン・タブレット・PC
          のブラウザからそのまま使えます。アプリのインストールは不要です。
        </p>
        <div className={styles.tipBox}>
          <strong>使い始める前に</strong>
          <ul>
            <li>インターネット接続が必要です（Wi-Fi または携帯回線）。</li>
            <li>
              カメラや音声入力を使う機能は、ブラウザから「カメラ・マイクの使用を許可」してください。
            </li>
            <li>iOS（iPhone / iPad）は Safari で最も安定して動作します。</li>
          </ul>
        </div>
      </section>

      {/* ========== 機能一覧 ========== */}
      <section className={styles.section}>
        <h2 className={styles.sectionTitle}>4 つの機能</h2>
        <div className={styles.featureGrid}>
          <div className={styles.featureCard}>
            <span className={styles.featureEmoji}>🎨</span>
            <div>
              <strong>イメージで提案</strong>
              <p>お客様の要望をヒアリングして整理します。</p>
            </div>
          </div>
          <div className={styles.featureCard}>
            <span className={styles.featureEmoji}>📸</span>
            <div>
              <strong>花を撮って見せる</strong>
              <p>店内の花を撮影して、AI が組み合わせ提案画像を生成します。</p>
            </div>
          </div>
          <div className={styles.featureCard}>
            <span className={styles.featureEmoji}>🗣️</span>
            <div>
              <strong>通訳モード</strong>
              <p>店員とお客様の会話をリアルタイムに翻訳します。</p>
            </div>
          </div>
          <div className={styles.featureCard}>
            <span className={styles.featureEmoji}>🏪</span>
            <div>
              <strong>店舗紹介</strong>
              <p>お店の URL から多言語の店舗案内を自動生成します。</p>
            </div>
          </div>
        </div>
      </section>

      {/* ========== 機能 1: イメージで提案 ========== */}
      <section className={styles.section}>
        <h2 className={styles.sectionTitle}>
          <span className={styles.badge}>機能 1</span> 🎨 イメージで提案
        </h2>
        <p className={styles.funcDesc}>
          お客様の希望（贈る相手・用途・予算など）をヒアリングして日本語に整理します。
          店員さんが花選びに集中できるよう、お客様との会話をサポートします。
        </p>

        <h3 className={styles.stepHeading}>使い方の流れ</h3>
        <ol className={styles.steps}>
          <li>
            <span className={styles.stepNum}>1</span>
            <div>
              <strong>言語を選ぶ</strong>
              <p>
                画面上部の言語ボタンからお客様の言語を選びます。自動検出もできますが、
                最初から選んでおくと確実です。
              </p>
            </div>
          </li>
          <li>
            <span className={styles.stepNum}>2</span>
            <div>
              <strong>お客様に話してもらう・入力してもらう</strong>
              <p>
                スマートフォンをお客様に向け、「🎤 音声で入力」ボタンを押してもらいます。
                または、テキストボックスに直接入力してもらうこともできます。
                入力後に「送信」ボタンを押します。
              </p>
            </div>
          </li>
          <li>
            <span className={styles.stepNum}>3</span>
            <div>
              <strong>AI がヒアリング項目を埋める</strong>
              <p>
                画面下の「ヒアリング状況」ボードに項目が順番に埋まっていきます。
                足りない項目は AI が自動で質問します。
              </p>
            </div>
          </li>
          <li>
            <span className={styles.stepNum}>4</span>
            <div>
              <strong>店員から追加で質問する（任意）</strong>
              <p>
                「店員から質問する」欄に日本語で質問を書いて「翻訳して聞く」を押すと、
                お客様の言語に翻訳されてチャットに追加されます。
                また、ヒアリングボードの各項目ボタンを押すと、
                その項目についての自然な質問文が自動生成されます。
              </p>
            </div>
          </li>
          <li>
            <span className={styles.stepNum}>5</span>
            <div>
              <strong>要約を確認する</strong>
              <p>
                全員分の情報が集まったら、画面右側（または下部）の「店員さん確認欄」に
                日本語で要約が表示されます。この内容をもとに花を選んでください。
              </p>
            </div>
          </li>
        </ol>

        <div className={styles.tipBox}>
          <strong>ヒント</strong>
          <ul>
            <li>
              「🔊 自動読み上げ」をオンにすると、AI の返答がお客様の言語で自動的に読み上げられます。
            </li>
            <li>
              ヒアリング項目は「贈る相手」「用途・場面」「予算」が必須です。色や花言葉・スタイルは任意です。
            </li>
            <li>
              「最初から」ボタンでいつでもリセットできます。
            </li>
          </ul>
        </div>
      </section>

      {/* ========== 機能 2: 花を撮って見せる ========== */}
      <section className={styles.section}>
        <h2 className={styles.sectionTitle}>
          <span className={styles.badge}>機能 2</span> 📸 花を撮って見せる
        </h2>
        <p className={styles.funcDesc}>
          お客様の希望を聞いた後、店内の花を撮影すると、AI が「その花だけを使った」
          組み合わせ提案画像を生成します。説明文はお客様の言語で表示・読み上げされます。
        </p>

        <h3 className={styles.stepHeading}>使い方の流れ</h3>
        <ol className={styles.steps}>
          <li>
            <span className={styles.stepNum}>1</span>
            <div>
              <strong>ステップ 1：要望を聞く</strong>
              <p>
                言語を選んでから、お客様に希望を話してもらいます（音声入力またはテキスト入力）。
                AI が花言葉なども含めて希望を整理します。必要に応じて数回やりとりします。
                「撮影へ進む」ボタンが現れたら次へ進めます。
              </p>
            </div>
          </li>
          <li>
            <span className={styles.stepNum}>2</span>
            <div>
              <strong>ステップ 2：店内の花を撮影する</strong>
              <p>
                「カメラで撮影」ボタンを押すとカメラが起動します。
                今日ある花を 1〜数枚撮影してください。
                撮影後は右上の「×」で削除もできます。
                ファイルから選ぶ場合は「写真を選ぶ」「動画を選ぶ」ボタンを使います。
              </p>
              <p>
                このステップでもお客様と追加のやりとりができます。
                お客様入力欄に話してもらうか、店員コメント欄から補足を伝えてください。
              </p>
            </div>
          </li>
          <li>
            <span className={styles.stepNum}>3</span>
            <div>
              <strong>ステップ 3：AI が画像を生成する</strong>
              <p>
                「提案画像を生成」ボタンを押すと AI が処理を開始します。
                10〜30 秒ほどかかることがあります。処理中は画面に「生成中...」と表示されます。
              </p>
            </div>
          </li>
          <li>
            <span className={styles.stepNum}>4</span>
            <div>
              <strong>ステップ 4：結果を見る・見せる</strong>
              <p>
                生成された提案画像と、お客様の言語での説明文（花言葉入り）が表示されます。
                スマートフォンの画面をお客様に向けてそのまま見せられます。
                「🔊 説明を読み上げる」ボタンで音声再生もできます。
              </p>
              <p>
                気に入らない場合は「別の組み合わせを生成」で再度生成できます。
                最初からやり直す場合は「最初から」を押してください。
              </p>
            </div>
          </li>
        </ol>

        <div className={styles.tipBox}>
          <strong>撮影のコツ</strong>
          <ul>
            <li>明るい場所で、花がはっきり映るように撮ると精度が上がります。</li>
            <li>
              複数種類の花がある場合は、それぞれを別のアングルから撮るとよい結果になります。
            </li>
            <li>
              AI は「撮影した花だけ」を使って提案します。写っていない花は使われません。
            </li>
            <li>動画を選んだ場合は、AI が代表フレームを自動抽出します。</li>
          </ul>
        </div>

        <div className={styles.warnBox}>
          <strong>注意</strong>
          <ul>
            <li>画像生成には AI の処理時間（数十秒）とインターネット通信が必要です。</li>
            <li>写真の合計サイズが大きすぎる場合はエラーになります。枚数を減らしてください。</li>
          </ul>
        </div>
      </section>

      {/* ========== 機能 3: 通訳モード ========== */}
      <section className={styles.section}>
        <h2 className={styles.sectionTitle}>
          <span className={styles.badge}>機能 3</span> 🗣️ 通訳モード
        </h2>
        <p className={styles.funcDesc}>
          店員とお客様が交互に話すだけで、自動的に翻訳します。
          テキスト入力にも対応しています。
        </p>

        <h3 className={styles.stepHeading}>使い方の流れ</h3>
        <ol className={styles.steps}>
          <li>
            <span className={styles.stepNum}>1</span>
            <div>
              <strong>言語ペアを選ぶ</strong>
              <p>
                左が店員の言語（日本語）、右がお客様の言語です。
                右側のドロップダウンからお客様の言語を選んでください。
              </p>
            </div>
          </li>
          <li>
            <span className={styles.stepNum}>2</span>
            <div>
              <strong>話す・入力する</strong>
              <p>
                「🎤 店員が話す」または「🎤 お客様が話す」のマイクボタンを押して話します。
                話し終わったら自動的に翻訳結果が表示されます。
                テキストボックスに直接入力して送信することもできます。
              </p>
            </div>
          </li>
          <li>
            <span className={styles.stepNum}>3</span>
            <div>
              <strong>翻訳結果を確認・読み上げ</strong>
              <p>
                翻訳結果が画面に表示されます。「🔊」ボタンを押すと音声で読み上げます。
                スマートフォンをお客様に向けて見せたり、読み上げを聞かせてください。
              </p>
            </div>
          </li>
        </ol>

        <div className={styles.tipBox}>
          <strong>ヒント</strong>
          <ul>
            <li>マイクボタンを押した後、少し間を置いてから話すと認識精度が上がります。</li>
            <li>
              周囲が騒がしい場合はテキスト入力がおすすめです。
            </li>
            <li>「履歴をクリア」でいつでも会話をリセットできます。</li>
          </ul>
        </div>
      </section>

      {/* ========== 機能 4: 店舗紹介 ========== */}
      <section className={styles.section}>
        <h2 className={styles.sectionTitle}>
          <span className={styles.badge}>機能 4</span> 🏪 店舗紹介
        </h2>
        <p className={styles.funcDesc}>
          お店のウェブサイト URL を入力するだけで、多言語の店舗案内文を自動生成します。
          観光客の多い時間帯などに、お店の説明をすばやく多言語で伝えられます。
        </p>

        <h3 className={styles.stepHeading}>使い方の流れ</h3>
        <ol className={styles.steps}>
          <li>
            <span className={styles.stepNum}>1</span>
            <div>
              <strong>お店の URL を入力する</strong>
              <p>
                テキストボックスにお店のウェブサイトやホットペッパー、食べログなど、
                お店の情報が載ったページの URL を貼り付けてください。
              </p>
            </div>
          </li>
          <li>
            <span className={styles.stepNum}>2</span>
            <div>
              <strong>「案内文を生成」を押す</strong>
              <p>
                ボタンを押すと AI がページを読み込み、店舗情報を整理して多言語の案内文を作ります。
                10〜30 秒ほどかかります。
              </p>
            </div>
          </li>
          <li>
            <span className={styles.stepNum}>3</span>
            <div>
              <strong>生成された案内文を見せる・読み上げる</strong>
              <p>
                英語・中国語・韓国語などの案内文がタブ形式で表示されます。
                お客様の言語のタブを選んで画面を向けるか、「🔊 読み上げ」ボタンを使ってください。
              </p>
            </div>
          </li>
        </ol>

        <div className={styles.tipBox}>
          <strong>ヒント</strong>
          <ul>
            <li>URL がない場合は、お店の名前・住所・営業時間などをテキストで貼り付けても動作します。</li>
            <li>生成結果は毎回微妙に変わることがあります。気に入ったら手元にコピーしておくと便利です。</li>
          </ul>
        </div>
      </section>

      {/* ========== よくある質問 ========== */}
      <section className={styles.section}>
        <h2 className={styles.sectionTitle}>よくある質問</h2>
        <dl className={styles.faq}>
          <dt>Q. カメラが真っ暗のまま映りません。</dt>
          <dd>
            ブラウザのカメラ許可を確認してください。iOS Safari の場合は「設定」→「Safari」→「カメラ」を「許可」にしてください。
            Android Chrome の場合はアドレスバーの鍵アイコンから「カメラ」を許可してください。
            許可後にページを再読み込みしてください。
          </dd>

          <dt>Q. 音声入力が反応しません。</dt>
          <dd>
            マイクの許可を確認してください。「🎤 話す」を押して話し、もう一度押して止めると、
            録音した音声を AI が文字に起こします（止めたあと数秒「聞き取り中…」と表示されます）。
            最初のひと言から録音されるので、ボタンを押してから話し始めて構いません。
            インターネット接続が必要です。
          </dd>

          <dt>Q. 「通信エラー」や「AI のエラー」が表示されました。</dt>
          <dd>
            インターネット接続を確認してから、もう一度操作してください。
            改善しない場合はページを再読み込み（リロード）してください。
            しばらく待ってから再試行すると解決することが多いです。
          </dd>

          <dt>Q. 生成された画像に、店内にない花が含まれていました。</dt>
          <dd>
            AI は撮影した写真・動画に映っている花だけを使うよう設計されていますが、
            まれに意図しない花が含まれることがあります。
            その場合は「別の組み合わせを生成」を押してもう一度試してください。
            より多くの花を鮮明に撮影すると改善することがあります。
          </dd>

          <dt>Q. 画像生成に時間がかかります。</dt>
          <dd>
            AI による画像生成は通常 10〜30 秒かかります。
            インターネット回線が遅い場合や、サーバーが混み合っている場合はさらに時間がかかることがあります。
            「生成中...」と表示されている間は操作せずお待ちください。
          </dd>

          <dt>Q. 対応している言語を教えてください。</dt>
          <dd>
            日本語・英語・中国語（簡体/繁体）・韓国語・スペイン語・フランス語・
            ドイツ語・イタリア語・ポルトガル語・ロシア語・タイ語・ベトナム語・インドネシア語の
            14 言語に対応しています。
          </dd>

          <dt>Q. お客様の情報はどこかに保存されますか？</dt>
          <dd>
            会話内容や写真はサーバーに一時的に送信して AI に処理させますが、
            データベースへの保存はしていません。ページを閉じると内容は消えます。
          </dd>
        </dl>
      </section>

      {/* ========== おすすめの使い方 ========== */}
      <section className={styles.section}>
        <h2 className={styles.sectionTitle}>シーン別おすすめの使い方</h2>
        <div className={styles.scenarioGrid}>
          <div className={styles.scenario}>
            <h3>🌏 外国人のお客様が来店したとき</h3>
            <p>
              まず「通訳モード」で挨拶から始めましょう。
              「プレゼントを探している」とわかったら「イメージで提案」に切り替えて
              ヒアリングすると効率的です。
            </p>
          </div>
          <div className={styles.scenario}>
            <h3>💐 今日の花でプレゼントを提案したいとき</h3>
            <p>
              「花を撮って見せる」が最適です。
              お客様の希望を聞いてから、今日入荷した花を撮影して提案します。
              写真を見せながら説明できるので、言葉が通じなくても伝わります。
            </p>
          </div>
          <div className={styles.scenario}>
            <h3>🗺️ 観光客にお店を説明したいとき</h3>
            <p>
              「店舗紹介」でお店の URL を読み込ませておきましょう。
              観光客がいつ来てもすぐに多言語の案内を見せられます。
            </p>
          </div>
          <div className={styles.scenario}>
            <h3>🤝 複雑な要望をじっくり聞きたいとき</h3>
            <p>
              「イメージで提案」でスロット（贈る相手・予算など）を埋めながら丁寧にヒアリングします。
              店員からも日本語で質問できるので、細かいニュアンスも確認できます。
            </p>
          </div>
        </div>
      </section>

      <div className={styles.backRow}>
        <Link href="/" className={styles.backLink}>
          ← トップページへ戻る
        </Link>
      </div>
    </div>
  );
}
