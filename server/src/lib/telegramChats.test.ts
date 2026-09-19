import assert from 'node:assert/strict'
import {
  canIngestFromChat,
  extractTelegramUpdate,
  guessChatType,
  isConnectedStatus,
  telegramChatTitle,
} from './telegramChats.ts'

assert.equal(guessChatType('-1001928523283'), 'supergroup')
assert.equal(guessChatType('-12345'), 'group')
assert.equal(guessChatType('8987700313'), 'private')

assert.equal(isConnectedStatus('member'), true)
assert.equal(isConnectedStatus('administrator'), true)
assert.equal(isConnectedStatus('creator'), true)
assert.equal(isConnectedStatus(null), true)
assert.equal(isConnectedStatus('left'), false)
assert.equal(isConnectedStatus('kicked'), false)

assert.equal(
  canIngestFromChat({ chatId: '-1001', type: 'supergroup', allowedChatId: '-1009' }),
  true,
)
assert.equal(canIngestFromChat({ chatId: '-1001', type: 'channel', allowedChatId: '' }), true)
assert.equal(canIngestFromChat({ chatId: '-50', type: 'group', allowedChatId: '' }), true)
assert.equal(
  canIngestFromChat({
    chatId: '-1001',
    type: 'supergroup',
    memberStatus: 'left',
    allowedChatId: '-1001',
  }),
  false,
)
assert.equal(
  canIngestFromChat({ chatId: '42', type: 'private', allowedChatId: '42' }),
  true,
)
assert.equal(
  canIngestFromChat({ chatId: '99', type: 'private', allowedChatId: '42' }),
  false,
)
assert.equal(canIngestFromChat({ chatId: '99', type: 'private', allowedChatId: '' }), false)

assert.equal(telegramChatTitle({ title: 'Karanald Social' }), 'Karanald Social')
assert.equal(telegramChatTitle({ first_name: 'Ada', last_name: 'Lovelace' }), 'Ada Lovelace')
assert.equal(telegramChatTitle({ username: 'ops_bot' }), '@ops_bot')
assert.equal(telegramChatTitle({ id: -1001 }), null)

const membership = extractTelegramUpdate({
  my_chat_member: {
    chat: { id: -1003900238771, type: 'supergroup', title: 'Karanald Social' },
    new_chat_member: { status: 'administrator' },
  },
})
assert.equal(membership?.kind, 'membership')
assert.equal(membership?.memberStatus, 'administrator')
assert.equal(String(membership?.chat.id), '-1003900238771')

const fileMessage = extractTelegramUpdate({
  channel_post: {
    message_id: 12,
    chat: { id: -1001928523283, type: 'supergroup', title: 'ME' },
    document: { file_id: 'x' },
  },
})
assert.equal(fileMessage?.kind, 'message')
assert.equal(String(fileMessage?.chat.title), 'ME')
assert.equal(fileMessage?.message?.message_id, 12)

assert.equal(extractTelegramUpdate({ update_id: 1 }), null)

console.log('telegram chats policy ok')
