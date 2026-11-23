/*
 * App.jsx — 화면 주소(라우트) 연결
 * [담당: 곽수호]
 */
import { Routes, Route } from 'react-router'
import { AppProvider } from './AppContext.jsx'
import { Layout, Page, PageHeader } from './components/Layout.jsx'
import { HomeScreen } from './screens/HomeScreen.jsx'
import { CharacterScreen } from './screens/CharacterScreen.jsx'
import { ChatScreen } from './screens/ChatScreen.jsx'
import { ChatsScreen } from './screens/ChatsScreen.jsx'
import { CreateScreen } from './screens/CreateScreen.jsx'
import { EditScreen } from './screens/EditScreen.jsx'
import { SettingsScreen } from './screens/SettingsScreen.jsx'
import { SetupScreen } from './screens/SetupScreen.jsx'
import { PrivacyScreen } from './screens/PrivacyScreen.jsx'

function NotFound() {
  return (
    <Page>
      <PageHeader title="페이지를 찾을 수 없어요" back="/" />
    </Page>
  )
}

export function App() {
  return (
    <AppProvider>
      <Routes>
        <Route element={<Layout />}>
          <Route index element={<HomeScreen />} />
          <Route path="chats" element={<ChatsScreen />} />
          <Route path="create" element={<CreateScreen />} />
          <Route path="create/form" element={<EditScreen />} />
          <Route path="characters/:id" element={<CharacterScreen />} />
          <Route path="characters/:id/edit" element={<EditScreen />} />
          <Route path="chat/:id" element={<ChatScreen />} />
          <Route path="settings" element={<SettingsScreen />} />
          <Route path="setup" element={<SetupScreen />} />
          <Route path="privacy" element={<PrivacyScreen />} />
          <Route path="*" element={<NotFound />} />
        </Route>
      </Routes>
    </AppProvider>
  )
}
