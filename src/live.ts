/** Lossless-enough presentation projection from the *real* Chatbus event contract.
 * No raw wire payloads, platform auth, or transport behavior escape this seam. */
import { toSocialSignal, type ChatEvent, type SocialSignalV1 } from '@myrqyry/chatbus';
import { fromChatbus, type DisplayMessage, type DisplayBadge, type DisplayNamePaint } from './chatbus';

export type OverlayLiveEvent =
  | { type: 'message'; message: DisplayMessage }
  | { type: 'badges'; messageId:string; badges:DisplayBadge[] }
  | { type: 'identity'; messageId:string; badges:DisplayBadge[]; namePaint?:DisplayNamePaint }
  | { type: 'delete'; messageId: string }
  | { type: 'clear'; sourceId?:string }
  | { type: 'user-clear'; sourceId?:string; userId?: string; username?: string };

const record = (value: unknown): Record<string, unknown> | null =>
  value !== null && typeof value === 'object' && !Array.isArray(value)
    ? value as Record<string, unknown> : null;
export function fromChatbusEvent(event: ChatEvent): OverlayLiveEvent | null {
  if (event.type === 'message-delete') {
    const messageId = record(event.data)?.messageId;
    return typeof messageId === 'string' && messageId
      ? { type: 'delete', messageId } : null;
  }
  if (event.type === 'user-timeout' || event.type === 'user-ban') {
    const user = event.user;
    if (!user?.id && !user?.username) return null;
    return { type: 'user-clear',
      ...(user.id ? { userId: user.id } : {}),
      ...(user.username ? { username: user.username } : {}),
    };
  }
  if (event.type === 'system') {
    const data = record(event.data);
    if (data?.kind === 'chat-clear') return { type: 'clear' };
    if (data?.kind === 'chat-clear-user' && (event.user?.id || event.user?.username)) {
      return { type: 'user-clear',
        ...(event.user?.id ? { userId: event.user.id } : {}),
        ...(event.user?.username ? { username: event.user.username } : {}),
      };
    }
  }
  if (!event.message || !['message', 'cheer', 'subscription'].includes(event.type)) return null;
  const message = event.message;
  // A notification without a meaningful body shouldn't create a blank chat item.
  if (!message.fragments?.length && !message.text) return null;
  return { type: 'message', message: fromChatbus(message) };
}

/** Chatbus's existing stable social-signal contract for future alerts/widgets.
 * Deliberately distinct from chat rows and moderation commands. */
export function fromChatbusSignal(event:ChatEvent,receivedAtMs=Date.now()):
  {type:'signal';signal:SocialSignalV1} {
  return {type:'signal',signal:toSocialSignal(event,{receivedAtMs})};
}
