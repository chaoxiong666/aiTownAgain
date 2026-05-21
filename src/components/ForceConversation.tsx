import { useMemo, useState } from 'react';
import { useServerGame } from '../hooks/serverGame';
import { useSendInput } from '../hooks/sendInput';
import { toastOnError } from '../toasts';
import { toast } from 'react-toastify';
import { Id } from '../../convex/_generated/dataModel';

interface NPCItem {
  playerId: string;
  name: string;
  inConversation: boolean;
}

export default function ForceConversation({
  worldId,
  engineId,
}: {
  worldId: Id<'worlds'>;
  engineId: Id<'engines'>;
}) {
  const game = useServerGame(worldId);
  const forceConv = useSendInput(engineId, 'forceConversation');

  const npcList: NPCItem[] = useMemo(() => {
    if (!game) return [];
    return [...game.world.players.values()]
      .filter((p) => !p.human)
      .map((p) => {
        const desc = game.playerDescriptions.get(p.id);
        const inConv = [...game.world.conversations.values()].some((c) =>
          c.participants.has(p.id),
        );
        return {
          playerId: p.id,
          name: desc?.name ?? '未知',
          inConversation: inConv,
        };
      });
  }, [game]);

  const [a, setA] = useState('');
  const [b, setB] = useState('');
  const canSubmit = a && b && a !== b;

  const handleSubmit = async () => {
    if (!canSubmit) return;
    const nameA = npcList.find((n) => n.playerId === a)?.name ?? '?';
    const nameB = npcList.find((n) => n.playerId === b)?.name ?? '?';
    await toastOnError(forceConv({ playerId: a, invitee: b }));
    toast(`正在撮合「${nameA}」与「${nameB}」...`);
    setA('');
    setB('');
  };

  if (!game || npcList.length < 2) {
    return (
      <div className="flex flex-col gap-2 p-3 bg-brown-900 rounded">
        <h3 className="text-lg text-brown-200">手动撮合</h3>
        <p className="text-sm text-brown-400">需要至少 2 个 NPC 才能使用此功能</p>
      </div>
    );
  }

  return (
    <div className="flex flex-col gap-2 p-3 bg-brown-900 rounded">
      <h3 className="text-lg text-brown-200">手动撮合</h3>
      <select
        value={a}
        onChange={(e) => setA(e.target.value)}
        className="bg-brown-800 text-brown-100 p-1 rounded text-sm"
      >
        <option value="">选择 NPC A</option>
        {npcList.map((n) => (
          <option key={n.playerId} value={n.playerId} disabled={n.playerId === b}>
            {n.name}{n.inConversation ? ' (对话中)' : ''}
          </option>
        ))}
      </select>
      <select
        value={b}
        onChange={(e) => setB(e.target.value)}
        className="bg-brown-800 text-brown-100 p-1 rounded text-sm"
      >
        <option value="">选择 NPC B</option>
        {npcList.map((n) => (
          <option key={n.playerId} value={n.playerId} disabled={n.playerId === a}>
            {n.name}{n.inConversation ? ' (对话中)' : ''}
          </option>
        ))}
      </select>
      <button
        disabled={!canSubmit}
        onClick={handleSubmit}
        className="button text-white shadow-solid text-sm py-1 cursor-pointer"
      >
        发起对话
      </button>
    </div>
  );
}
