/*
 * KeyVaultContext.jsx — API 키 계정 저장 화면 흐름 (팝업들)
 * [담당: 곽수호]   실제 암호화·저장은 storage/keyVault.js
 *
 * 로그인 직후 자동으로 묻는 것
 *   - 계정에 키 있음 + 이 기기에 키 없음 → "저장된 API 키를 불러오시겠습니까?" (비밀번호 입력)
 *   - 계정에 키 없음 + 이 기기에 키 있음 → "이 API 키를 계정에 저장할까요?" (비밀번호 정하기)
 *   "아니요"를 누르면 이 기기에서는 그 계정으로 다시 묻지 않는다 (설정에서 언제든 가능).
 *
 * 화면에서는 const { info, openLoad, openSave, openChange, removeFromAccount } = useKeyVault()
 */
import { createContext, useCallback, useContext, useEffect, useMemo, useState } from 'react'
import { useNavigate } from 'react-router'
import { getProvider } from '../common/providers.js'
import { loadConfig } from '../common/config.js'
import {
  getAccountKeyInfo,
  saveKeyToAccount,
  unlockKeyFromAccount,
  changeKeyPassword,
  deleteKeyFromAccount,
} from '../storage/keyVault.js'
import { useApp } from './AppContext.jsx'
import { PasswordModal } from './components/PasswordModal.jsx'
import { Modal } from './components/Modal.jsx'

const KeyVaultContext = createContext(null)
export const useKeyVault = () => useContext(KeyVaultContext)

const dismissKey = (uid) => `ost3.keyPromptDismissed.${uid}`

function isDismissed(uid) {
  try {
    return localStorage.getItem(dismissKey(uid)) === '1'
  } catch {
    return false
  }
}

function setDismissed(uid) {
  try {
    localStorage.setItem(dismissKey(uid), '1')
  } catch {
    /* 무시 */
  }
}

/** 이 기기에 실제 AI 키가 있는지 (테스트 모드 제외) */
export function hasLocalKey(config) {
  return Boolean(config.provider && config.provider !== 'test' && config.apiKey)
}

export function KeyVaultProvider({ children }) {
  const { config, setConfig, user, ready, migrateOpen, toast, toastError } = useApp()
  const navigate = useNavigate()
  const [info, setInfo] = useState(null) // 계정에 저장된 키 정보 (없으면 null)
  const [modal, setModal] = useState(null) // { kind: 'load'|'save'|'change', auto?: bool, cfg? }
  const [confirmForget, setConfirmForget] = useState(false)
  const [forgetting, setForgetting] = useState(false)
  const uid = user?.id ?? null

  // 로그아웃하면 계정 키 정보도 지운다
  useEffect(() => {
    if (!uid) setInfo(null)
  }, [uid])

  const refreshInfo = useCallback(async () => {
    if (!uid) {
      setInfo(null)
      return null
    }
    try {
      const i = await getAccountKeyInfo()
      setInfo(i)
      return i
    } catch (e) {
      toastError(e)
      return null
    }
  }, [uid, toastError])

  // 로그인 직후 한 번: 상황에 맞는 팝업 (옮기기 질문 창이 닫힌 뒤에)
  useEffect(() => {
    if (!ready || !uid || migrateOpen) return
    let alive = true
    refreshInfo().then((i) => {
      if (!alive || isDismissed(uid)) return
      const local = hasLocalKey(config)
      if (i && !local) setModal({ kind: 'load', auto: true })
      else if (!i && local) setModal({ kind: 'save', auto: true, cfg: config })
    })
    return () => {
      alive = false
    }
    // config 는 일부러 넣지 않는다: 설정을 바꿀 때마다 다시 묻지 않게 (로그인했을 때만)
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [ready, uid, migrateOpen, refreshInfo])

  const close = useCallback(() => {
    setModal((m) => {
      if (m?.auto && uid) setDismissed(uid) // 자동으로 물은 것에 "아니요" → 다시 안 묻기
      return null
    })
  }, [uid])

  async function handleSubmit({ password, newPassword }) {
    if (modal.kind === 'load') {
      const k = await unlockKeyFromAccount(password)
      // 렌더링 때의 config 대신 지금 저장된 설정 위에 덮어쓴다
      setConfig({ ...loadConfig(), provider: k.provider, apiKey: k.apiKey, modelLight: k.modelLight, modelHeavy: k.modelHeavy })
      toast(`${getProvider(k.provider)?.name || k.provider} API 키를 불러왔어요.`)
    } else if (modal.kind === 'save') {
      const cfg = modal.cfg || loadConfig()
      await saveKeyToAccount(cfg, newPassword)
      toast('API 키를 비밀번호로 잠가 계정에 저장했어요.')
    } else if (modal.kind === 'change') {
      await changeKeyPassword(password, newPassword)
      toast('API 키 비밀번호를 바꿨어요.')
    }
    setModal(null)
    refreshInfo()
  }

  async function forget() {
    setForgetting(true)
    try {
      await deleteKeyFromAccount()
      setModal(null)
      setConfirmForget(false)
      await refreshInfo()
      toast('계정에 저장된 키를 지웠어요. 키를 다시 입력하고 새 비밀번호로 저장해 주세요.')
      navigate('/settings#ai')
    } catch (e) {
      toastError(e)
    } finally {
      setForgetting(false)
    }
  }

  const value = useMemo(
    () => ({
      info,
      refreshInfo,
      // 열기 직전에 정보를 새로 받아 잠금 남은 시간이 정확하게 (로그인 때 받은 값은 낡았을 수 있음)
      openLoad: async () => {
        await refreshInfo()
        setModal({ kind: 'load' })
      },
      openSave: (cfg) => setModal({ kind: 'save', cfg }),
      openChange: () => setModal({ kind: 'change' }),
      removeFromAccount: async () => {
        await deleteKeyFromAccount()
        await refreshInfo()
      },
    }),
    [info, refreshInfo],
  )

  const providerName = getProvider(info?.provider)?.name || info?.provider
  const saveCfg = modal?.cfg || config
  const texts = {
    load: {
      title: '저장된 API 키를 불러오시겠습니까?',
      description: info ? `${providerName} · 저비용 ${info.modelLight || '-'} · 고성능 ${info.modelHeavy || '-'}` : '',
      submitText: '불러오기',
      cancelText: modal?.auto ? '아니요' : '취소',
    },
    save: {
      title: info ? '계정에 저장된 키를 이 키로 바꿀까요?' : '이 API 키를 계정에 저장할까요?',
      description: `${getProvider(saveCfg.provider)?.name || saveCfg.provider}의 키를 비밀번호로 잠가 계정에 저장해요. 다른 기기에서는 로그인 후 이 비밀번호만 입력하면 돼요. 원래 키는 서버에 저장되지 않아요.`,
      submitText: '저장',
      cancelText: modal?.auto ? '아니요' : '취소',
    },
    change: { title: 'API 키 비밀번호 바꾸기', description: '', submitText: '바꾸기', cancelText: '취소' },
  }
  const t = modal ? texts[modal.kind] : texts.load

  return (
    <KeyVaultContext.Provider value={value}>
      {children}
      <PasswordModal
        open={Boolean(modal) && !confirmForget}
        mode={modal?.kind === 'save' ? 'create' : modal?.kind === 'change' ? 'change' : 'unlock'}
        title={t.title}
        description={t.description}
        submitText={t.submitText}
        cancelText={t.cancelText}
        lockedSeconds={modal?.kind === 'load' ? info?.lockedSeconds || 0 : 0}
        onSubmit={handleSubmit}
        onClose={close}
        onForgot={() => setConfirmForget(true)}
      />
      {/* 지우는 동안 비밀번호 창이 다시 보이지 않게, 지우기가 끝난 뒤에 닫는다 */}
      <Modal
        open={confirmForget}
        title="계정에 저장된 키를 지울까요?"
        onClose={forgetting ? undefined : () => setConfirmForget(false)}
        actions={
          <>
            <button className="btn btn-ghost" onClick={() => setConfirmForget(false)} disabled={forgetting}>
              취소
            </button>
            <button className="btn bg-red-600 text-white hover:bg-red-700" onClick={forget} disabled={forgetting}>
              {forgetting ? '지우는 중…' : '지우기'}
            </button>
          </>
        }
      >
        비밀번호는 어디에도 저장하지 않아서 되찾을 수 없어요. 저장된 키를 지운 뒤, 키를 다시 입력하고 새 비밀번호로 저장하면 돼요.
      </Modal>
    </KeyVaultContext.Provider>
  )
}
