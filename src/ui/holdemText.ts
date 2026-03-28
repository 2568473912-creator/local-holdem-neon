import { t, type AppLanguage } from '../i18n';

function replaceRegex(text: string, pattern: RegExp, replacer: (...args: string[]) => string): string {
  return text.replace(pattern, (...args) => replacer(...args.slice(1, -2) as string[]));
}

export function translateHoldemText(text: string, language: AppLanguage): string {
  if (!text || language === 'zh-CN') {
    return text;
  }

  const directMap: Record<string, string> = {
    等待: t(language, 'seat.waiting'),
    淘汰: t(language, 'seat.eliminated'),
    弃牌: t(language, 'action.fold'),
    过牌: t(language, 'action.check'),
    跟注: t(language, 'action.call'),
    下注: t(language, 'action.bet'),
    加注: t(language, 'action.raise'),
    准备发牌: t(language, 'holdem.readyToDeal'),
    进入摊牌: t(language, 'holdem.enterShowdown'),
    本局结束: t(language, 'holdem.handFinished'),
    比赛结束: t(language, 'holdem.matchFinished'),
    第一轮下注: t(language, 'holdem.bettingRound1'),
    翻前行动: t(language, 'holdem.preflopAction'),
    '翻前行动（跨注生效）': t(language, 'holdem.preflopActionStraddle'),
    第二轮发牌: t(language, 'holdem.secondDeal'),
    第三轮发牌: t(language, 'holdem.thirdDeal'),
    第四轮发牌: t(language, 'holdem.fourthDeal'),
    翻牌圈: t(language, 'holdem.flopRound'),
    转牌圈: t(language, 'holdem.turnRound'),
    河牌圈: t(language, 'holdem.riverRound'),
    '比赛结束，仅剩一名玩家': t(language, 'holdem.sessionComplete'),
    欢迎来到霓虹德州单机局: t(language, 'holdem.welcomeBanner'),
    '比赛已结束，请重新开始': t(language, 'holdem.matchOverRestart'),
    自动行动已取消: t(language, 'holdem.autoActionCancelled'),
    新牌局开始: t(language, 'holdem.newHandStarted'),
    未找到可继续的存档: t(language, 'holdem.noResumeSave'),
    已返回主菜单: t(language, 'holdem.returnedToMenu'),
    继续游戏: t(language, 'common.resume'),
    游戏已暂停: t(language, 'holdem.gamePaused'),
    已清空本地生涯战绩: t(language, 'replay.careerCleared'),
    已清空本地回放归档: t(language, 'replay.archiveCleared'),
    回放快照缺失:
      language === 'ja'
        ? 'リプレイスナップショットなし'
        : language === 'fr'
          ? 'Instantané du replay indisponible'
          : language === 'de'
            ? 'Replay-Schnappschuss fehlt'
            : 'Replay snapshot missing',
  };

  if (directMap[text]) {
    return directMap[text];
  }

  let value = text;
  value = replaceRegex(value, /^跟注 (\d+)$/, ([amount]) => `${t(language, 'action.call')} ${amount}`);
  value = replaceRegex(value, /^全下 (\d+)$/, ([amount]) => `${t(language, 'action.allIn')} ${amount}`);
  value = replaceRegex(value, /^下注到 (\d+)$/, ([amount]) => `${t(language, 'action.bet')} ${amount}`);
  value = replaceRegex(value, /^加注到 (\d+)$/, ([amount]) => `${t(language, 'action.raise')} ${amount}`);
  value = replaceRegex(value, /^盲注全下 (\d+)$/, ([amount]) => `${t(language, 'holdem.blindAllIn')} ${amount}`);
  value = replaceRegex(value, /^盲注 (\d+)$/, ([amount]) => `${t(language, 'holdem.blindPosted')} ${amount}`);
  value = replaceRegex(value, /^前注全下 (\d+)$/, ([amount]) => `${t(language, 'holdem.anteAllIn')} ${amount}`);
  value = replaceRegex(value, /^前注 (\d+)$/, ([amount]) => `${t(language, 'holdem.antePosted')} ${amount}`);
  value = replaceRegex(value, /^跟注全下 (\d+)$/, ([amount]) => `${t(language, 'holdem.callAllIn')} ${amount}`);
  value = replaceRegex(value, /^全下开池 (\d+)$/, ([amount]) => `${t(language, 'holdem.allInOpen')} ${amount}`);
  value = replaceRegex(value, /^全下到 (\d+)$/, ([amount]) => `${t(language, 'holdem.allInTo')} ${amount}`);
  value = replaceRegex(value, /^全下跟注 (\d+)$/, ([amount]) => `${t(language, 'holdem.allInCall')} ${amount}`);
  value = replaceRegex(value, /^(.+) 收下全部底池 (\d+)$/, ([name, amount]) => t(language, 'holdem.scoopsPot', { name, amount }));
  value = replaceRegex(value, /^摊牌结束：(.+) 获胜$/, ([names]) => t(language, 'holdem.showdownWonBy', { names }));
  value = replaceRegex(value, /^创建边池 (.+)（(\d+)）$/, ([potId, amount]) => t(language, 'holdem.createSidePot', { potId, amount }));
  value = replaceRegex(value, /^(.+) 赢得 (\d+)$/, ([target, amount]) => t(language, 'holdem.playerWonAmount', { target, amount }));
  value = replaceRegex(value, /^(.+) 被淘汰$/, ([name]) => t(language, 'holdem.playerEliminated', { name }));
  value = replaceRegex(value, /^(.+) 获得第 (\d+) 张牌$/, ([name, count]) => t(language, 'holdem.playerReceivesNthCard', { name, count }));
  value = replaceRegex(value, /^第 (\d+) 手开始$/, ([handId]) => t(language, 'holdem.handStart', { handId }));
  value = replaceRegex(value, /^(.+) 获得底牌$/, ([name]) => t(language, 'holdem.playerReceivesHoleCards', { name }));
  value = replaceRegex(value, /^(.+) 投入前注 (\d+)$/, ([name, amount]) => t(language, 'holdem.playerPostsAnte', { name, amount }));
  value = replaceRegex(value, /^(.+) 投入小盲 (\d+)$/, ([name, amount]) => t(language, 'holdem.playerPostsSmallBlind', { name, amount }));
  value = replaceRegex(value, /^(.+) 投入大盲 (\d+)$/, ([name, amount]) => t(language, 'holdem.playerPostsBigBlind', { name, amount }));
  value = replaceRegex(value, /^(.+) 投入跨注 (\d+)$/, ([name, amount]) => t(language, 'holdem.playerPostsStraddle', { name, amount }));
  value = replaceRegex(value, /^进入(.+)$/, ([stage]) => t(language, 'holdem.enterStage', { stage: translateHoldemText(stage, language) }));
  value = replaceRegex(value, /^发出翻牌$/, () => t(language, 'holdem.dealFlop'));
  value = replaceRegex(value, /^发出转牌$/, () => t(language, 'holdem.dealTurn'));
  value = replaceRegex(value, /^发出河牌$/, () => t(language, 'holdem.dealRiver'));
  value = replaceRegex(value, /^盲注升级至 (\d+)\/(\d+)（等级 L(\d+)）$/, ([sb, bb, level]) =>
    t(language, 'holdem.blindsUpTo', { sb, bb, level }),
  );
  value = replaceRegex(value, /^直达(.+)阶段$/, ([stage]) => {
    const translatedStage = translateHoldemText(stage, language);
    if (language === 'ja') return `${translatedStage} へ移動`;
    if (language === 'fr') return `Aller à ${translatedStage}`;
    if (language === 'de') return `Direkt zu ${translatedStage}`;
    return `Jump to ${translatedStage}`;
  });
  value = replaceRegex(value, /^(.+) 施压后逼退对手并收池，可能是诈唬成功线$/, ([name]) => {
    if (language === 'ja') return `${name} が圧力で相手を降ろしてポット獲得。ブラフ成功ラインの可能性。`;
    if (language === 'fr') return `${name} a mis la pression, fait coucher l’adversaire et remporté le pot : ligne de bluff probable.`;
    if (language === 'de') return `${name} hat Druck gemacht, den Gegner zum Fold gebracht und den Pot gewonnen. Wahrscheinlich eine erfolgreiche Bluff-Linie.`;
    return `${name} applied pressure, forced folds, and collected the pot. Likely a successful bluff line.`;
  });
  value = replaceRegex(value, /^(.+) 带诈唬标签下注后未摊牌收池，建议复盘下注动机$/, ([name]) => {
    if (language === 'ja') return `${name} はブラフ系アクションの後、ショーダウンなしでポット獲得。意図の見直しを推奨。`;
    if (language === 'fr') return `${name} a pris le pot sans showdown après une mise étiquetée bluff ; revoir l’intention de mise.`;
    if (language === 'de') return `${name} gewann den Pot nach einer Bluff-Aktion ohne Showdown. Die Einsatzabsicht sollte geprüft werden.`;
    return `${name} won the pot without showdown after a bluff-tagged bet. Review the betting intent.`;
  });
  value = replaceRegex(value, /^继续第 (\d+) 手$/, ([handId]) => t(language, 'holdem.resumeHand', { handId }));
  value = replaceRegex(value, /^AI 难度已切换：(.+)$/, ([level]) => t(language, 'holdem.aiDifficultyChanged', { value: translateHoldemText(level, language) }));
  value = replaceRegex(value, /^已设置自动行动：(.+)$/, ([preset]) => t(language, 'holdem.autoActionSet', { preset }));
  value = replaceRegex(value, /^已清除自动行动$/, () => t(language, 'holdem.autoActionCleared'));
  value = replaceRegex(value, /^当前有待跟注金额，无法过牌$/, () => t(language, 'holdem.reasonCannotCheckFacingBet'));
  value = replaceRegex(value, /^当前无需跟注$/, () => t(language, 'holdem.reasonNoCallNeeded'));
  value = replaceRegex(value, /^无下注压力也可主动弃牌$/, () => t(language, 'holdem.reasonCanFoldFree'));
  value = replaceRegex(value, /^当前玩家不可行动$/, () => t(language, 'holdem.reasonPlayerInactive'));
  value = replaceRegex(value, /^尚未轮到你行动$/, () => t(language, 'holdem.reasonNotYourTurn'));
  value = replaceRegex(value, /^底池限注下当前不可达最小下注，可考虑全下$/, () => t(language, 'holdem.reasonPotLimitMinBet'));
  value = replaceRegex(value, /^筹码不足最小下注，使用全下$/, () => t(language, 'holdem.reasonMinBetAllIn'));
  value = replaceRegex(value, /^底池限注上限不足以完成最小加注，可考虑全下\/跟注$/, () => t(language, 'holdem.reasonPotLimitMinRaise'));
  value = replaceRegex(value, /^筹码不足最小加注，使用全下$/, () => t(language, 'holdem.reasonMinRaiseAllIn'));
  value = replaceRegex(value, /^此前加注未达到最小加注，不可再加注，只能跟注或弃牌$/, () => t(language, 'holdem.reasonRaiseLocked'));
  value = replaceRegex(value, /^当前不可重新加注，全下会构成非法加注$/, () => t(language, 'holdem.reasonIllegalAllInRaise'));
  value = replaceRegex(value, /^底池限注下全下金额超出上限$/, () => t(language, 'holdem.reasonAllInOverPotLimit'));
  value = replaceRegex(value, /^玩家不存在$/, () => t(language, 'holdem.reasonPlayerMissing'));
  value = replaceRegex(value, /^未轮到该玩家行动$/, () => t(language, 'holdem.reasonWrongActor'));
  value = replaceRegex(value, /^玩家当前不可操作$/, () => t(language, 'holdem.reasonPlayerUnavailable'));
  value = replaceRegex(value, /^存在待跟注金额，不能过牌$/, () => t(language, 'holdem.reasonCannotCheckFacingBet'));
  value = replaceRegex(value, /^筹码为 0，无法全下$/, () => t(language, 'holdem.reasonNoChipsForAllIn'));
  value = replaceRegex(value, /^当前已有下注，应使用加注$/, () => t(language, 'holdem.reasonUseRaise'));
  value = replaceRegex(value, /^下注金额缺失$/, () => t(language, 'holdem.reasonBetAmountMissing'));
  value = replaceRegex(value, /^下注金额超过底池限注上限$/, () => t(language, 'holdem.reasonBetOverPotLimit'));
  value = replaceRegex(value, /^下注金额超过可用筹码$/, () => t(language, 'holdem.reasonBetOverStack'));
  value = replaceRegex(value, /^下注低于最小下注$/, () => t(language, 'holdem.reasonBetBelowMin'));
  value = replaceRegex(value, /^当前无人下注，应使用下注$/, () => t(language, 'holdem.reasonUseBet'));
  value = replaceRegex(value, /^此前加注不足最小加注，当前不可再加注$/, () => t(language, 'holdem.reasonRaiseBelowThresholdLocked'));
  value = replaceRegex(value, /^加注金额缺失$/, () => t(language, 'holdem.reasonRaiseAmountMissing'));
  value = replaceRegex(value, /^加注金额超过底池限注上限$/, () => t(language, 'holdem.reasonRaiseOverPotLimit'));
  value = replaceRegex(value, /^加注金额超过可用筹码$/, () => t(language, 'holdem.reasonRaiseOverStack'));
  value = replaceRegex(value, /^加注低于最小加注门槛$/, () => t(language, 'holdem.reasonRaiseBelowMin'));
  value = replaceRegex(value, /^未知动作类型$/, () => t(language, 'holdem.reasonUnknownAction'));

  return value;
}
