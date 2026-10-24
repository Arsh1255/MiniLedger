import { useCallback, useEffect, useMemo, useRef, useState, type ComponentRef } from 'react';
import { ActivityIndicator, Animated, Image, Keyboard, KeyboardAvoidingView, Platform, Pressable, ScrollView, StyleSheet, View } from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';
import { Appbar, Avatar, Button, Card, Dialog, Divider, FAB, HelperText, IconButton, List, Menu, Portal, ProgressBar, Snackbar, Text, TextInput } from 'react-native-paper';
import { LinearGradient } from 'expo-linear-gradient';
import { DateTimePicker } from '@expo/ui/community/datetime-picker';
import * as ImagePicker from 'expo-image-picker';
import * as Haptics from 'expo-haptics';

const API = process.env.EXPO_PUBLIC_API_URL || 'http://10.0.2.2:4000';
type Loan = { id: string; friendName: string; amount: number; dueDate: string; repaid: boolean; repaidAt?: string | null; hasReceipt: boolean; createdAt: string };
type Summary = { totalLent: number; totalRepaid: number; overdueAmount: number };
const emptySummary: Summary = { totalLent: 0, totalRepaid: 0, overdueAmount: 0 };
const money = (value: number) => `₹${value.toLocaleString('en-IN', { maximumFractionDigits: 0 })}`;
const today = () => dateToInput(new Date());
const formatDate = (date: string) => new Date(`${date}T00:00:00`).toLocaleDateString('en-IN', { day: 'numeric', month: 'short', year: 'numeric' });
const dateToInput = (date: Date) => `${date.getFullYear()}-${String(date.getMonth() + 1).padStart(2, '0')}-${String(date.getDate()).padStart(2, '0')}`;
const dateFromInput = (date: string) => {
  const [year, month, day] = date.split('-').map(Number);
  return new Date(year, month - 1, day, 12);
};
const subtleHaptic = () => {
  if (Platform.OS !== 'web') void Haptics.impactAsync(Haptics.ImpactFeedbackStyle.Light).catch(() => undefined);
};
const successHaptic = () => {
  if (Platform.OS !== 'web') void Haptics.notificationAsync(Haptics.NotificationFeedbackType.Success).catch(() => undefined);
};

async function api<T>(path: string, init?: RequestInit): Promise<T> {
  const controller = new AbortController();
  const timer = setTimeout(() => controller.abort(), 8000);
  const isFormData = typeof FormData !== 'undefined' && init?.body instanceof FormData;
  try {
    const response = await fetch(`${API}${path}`, {
      ...init,
      signal: controller.signal,
      headers: { ...(!isFormData ? { 'Content-Type': 'application/json' } : {}), ...(init?.headers || {}) },
    });
    const body = await response.json();
    if (!response.ok) throw new Error(body.error || `Request failed (${response.status})`);
    return body as T;
  } catch (error) {
    if (error instanceof Error && error.name === 'AbortError') {
      throw new Error(`The API did not respond. Check that the API is running and reachable at ${API}.`);
    }
    if (error instanceof TypeError) {
      throw new Error(`Couldn't connect to ${API}. Check Wi-Fi and Windows Firewall, then make sure the API is running.`);
    }
    throw error;
  } finally {
    clearTimeout(timer);
  }
}

export default function HomeScreen() {
  const loginScrollRef = useRef<ComponentRef<typeof ScrollView>>(null);
  const [homeScrollY] = useState(() => new Animated.Value(0));
  const [dashboardBounce] = useState(() => new Animated.Value(1));
  const topCardsHidden = useRef(false);
  const [phone, setPhone] = useState('');
  const [otp, setOtp] = useState('');
  const [otpSent, setOtpSent] = useState(false);
  const [loggedIn, setLoggedIn] = useState(false);
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState('');
  const [notice, setNotice] = useState('');
  const [loans, setLoans] = useState<Loan[]>([]);
  const [summary, setSummary] = useState<Summary>(emptySummary);
  const [showAdd, setShowAdd] = useState(false);
  const [receiptAsset, setReceiptAsset] = useState<ImagePicker.ImagePickerAsset | null>(null);
  const [receiptLoan, setReceiptLoan] = useState<Loan | null>(null);
  const [receiptLoadFailed, setReceiptLoadFailed] = useState(false);
  const [showDatePicker, setShowDatePicker] = useState(false);
  const [pickerDate, setPickerDate] = useState(() => new Date(Date.now() + 7 * 86400000));
  const [showSortMenu, setShowSortMenu] = useState(false);
  const [sortBy, setSortBy] = useState<'dueDate' | 'repaidAt' | 'amount' | 'friend'>('dueDate');
  const [sortDirection, setSortDirection] = useState<'asc' | 'desc'>('asc');
  const [showAppMenu, setShowAppMenu] = useState(false);
  const [showClearConfirm, setShowClearConfirm] = useState(false);
  const [showDeleteConfirm, setShowDeleteConfirm] = useState(false);
  const [selectedLoanIds, setSelectedLoanIds] = useState<string[]>([]);
  const [friendName, setFriendName] = useState('');
  const [amount, setAmount] = useState('');
  const [dueDate, setDueDate] = useState(() => dateToInput(new Date(Date.now() + 7 * 86400000)));
  useEffect(() => {
    const listenerId = homeScrollY.addListener(({ value }) => {
      const hidden = value >= 165;
      if (hidden === topCardsHidden.current) return;
      topCardsHidden.current = hidden;
      subtleHaptic();
    });
    return () => homeScrollY.removeListener(listenerId);
  }, [homeScrollY]);
  const dashboardScaleX = useMemo(() => Animated.multiply(
    homeScrollY.interpolate({ inputRange: [-90, 0, 130], outputRange: [1.04, 1, 0.97], extrapolate: 'clamp' }),
    dashboardBounce.interpolate({ inputRange: [0, 0.8, 1, 1.12], outputRange: [0.985, 1.025, 1, 0.99] })
  ), [dashboardBounce, homeScrollY]);
  const dashboardScaleY = useMemo(() => Animated.multiply(
    homeScrollY.interpolate({ inputRange: [-90, 0, 130], outputRange: [1.09, 1, 0.95], extrapolate: 'clamp' }),
    dashboardBounce.interpolate({ inputRange: [0, 0.8, 1, 1.12], outputRange: [0.96, 1.06, 1, 1.01] })
  ), [dashboardBounce, homeScrollY]);
  const dashboardTranslateY = useMemo(() => Animated.add(
    homeScrollY.interpolate({ inputRange: [-90, 0, 130], outputRange: [16, 0, -16], extrapolate: 'clamp' }),
    dashboardBounce.interpolate({ inputRange: [0, 0.8, 1, 1.12], outputRange: [0, -7, 0, 1] })
  ), [dashboardBounce, homeScrollY]);
  const onHomeScroll = useMemo(() => Animated.event(
    [{ nativeEvent: { contentOffset: { y: homeScrollY } } }],
    { useNativeDriver: true }
  ), [homeScrollY]);
  const bounceDashboardNearTop = (event: { nativeEvent: { contentOffset: { y: number } } }) => {
    if (event.nativeEvent.contentOffset.y > 100) return;
    dashboardBounce.stopAnimation();
    dashboardBounce.setValue(0);
    Animated.spring(dashboardBounce, { toValue: 1, speed: 18, bounciness: 10, useNativeDriver: true }).start();
  };

  const refresh = useCallback(async () => {
    const [items, totals] = await Promise.all([api<Loan[]>('/api/loans'), api<Summary>('/api/summary')]);
    setLoans(items);
    setSummary(totals);
  }, [setLoans, setSummary]);
  useEffect(() => {
    if (!loggedIn) return;
    let active = true;
    const load = async () => {
      try {
        const [items, totals] = await Promise.all([api<Loan[]>('/api/loans'), api<Summary>('/api/summary')]);
        if (active) { setLoans(items); setSummary(totals); }
      } catch (err) {
        if (active) setError(err instanceof Error ? err.message : 'Could not load loans.');
      }
    };
    void load();
    return () => { active = false; };
  }, [loggedIn]);
  useEffect(() => {
    if (loggedIn) return;
    const subscription = Keyboard.addListener(Platform.OS === 'ios' ? 'keyboardWillShow' : 'keyboardDidShow', () => {
      requestAnimationFrame(() => loginScrollRef.current?.scrollToEnd({ animated: true }));
    });
    return () => subscription.remove();
  }, [loggedIn]);

  const sendOtp = async () => {
    const digits = phone.replace(/\D/g, '');
    if (!/^\d{10}$/.test(digits)) { setError('Enter a 10-digit phone number.'); return; }
    setError(''); setBusy(true);
    try {
      await api('/api/auth/request-otp', { method: 'POST', body: JSON.stringify({ phone: digits }) });
      setOtpSent(true);
      setNotice('Demo OTP sent. Check the API terminal.');
    } catch (err) { setError(err instanceof Error ? err.message : 'Could not send the code.'); }
    finally { setBusy(false); }
  };
  const verifyOtp = async () => {
    setError(''); setBusy(true);
    try {
      await api('/api/auth/verify-otp', { method: 'POST', body: JSON.stringify({ phone: phone.replace(/\D/g, ''), otp }) });
      setLoggedIn(true);
    } catch (err) { setError(err instanceof Error ? err.message : 'Could not verify the code.'); }
    finally { setBusy(false); }
  };
  const saveLoan = async () => {
    if (!friendName.trim()) { setError('Enter your friend’s name.'); return; }
    if (!Number.isFinite(Number(amount)) || Number(amount) <= 0) { setError('Enter an amount greater than zero.'); return; }
    if (!/^\d{4}-\d{2}-\d{2}$/.test(dueDate) || Number.isNaN(Date.parse(`${dueDate}T00:00:00`))) { setError('Enter a valid due date.'); return; }
    if (dueDate < today()) { setError('Due date can’t be in the past.'); return; }
    if (receiptAsset && !receiptAsset.base64) { setError('Could not read the selected receipt image. Please choose it again.'); return; }
    setError(''); setBusy(true);
    try {
      if (receiptAsset?.base64 && receiptAsset.base64.length * 0.75 > 5 * 1024 * 1024) {
        setError('Receipt image must be 5 MB or smaller. Choose a smaller photo.');
        return;
      }
      await api('/api/loans', {
        method: 'POST',
        body: JSON.stringify({
          friendName: friendName.trim(),
          amount: Number(amount),
          dueDate,
          ...(receiptAsset?.base64 ? { receiptBase64: receiptAsset.base64, receiptMimeType: 'image/jpeg' } : {}),
        }),
      });
      setFriendName(''); setAmount(''); setReceiptAsset(null); setShowAdd(false); await refresh(); setNotice('Loan added.');
      successHaptic();
    } catch (err) { setError(err instanceof Error ? err.message : 'Could not save the loan.'); }
    finally { setBusy(false); }
  };
  const markRepaid = async (loan: Loan) => {
    try {
      await api(`/api/loans/${loan.id}/repaid`, { method: 'PATCH' });
      await refresh(); setNotice(`${loan.friendName}’s loan marked as repaid.`); successHaptic();
    } catch (err) { setNotice(err instanceof Error ? err.message : 'Could not update the loan.'); }
  };
  const toggleLoanSelection = (id: string) => {
    setSelectedLoanIds((current) => current.includes(id) ? current.filter((item) => item !== id) : [...current, id]);
  };
  const deleteSelectedLoans = async () => {
    setBusy(true);
    try {
      await Promise.all(selectedLoanIds.map((id) => api(`/api/loans/${id}`, { method: 'DELETE' })));
      setSelectedLoanIds([]);
      setShowDeleteConfirm(false);
      await refresh();
      setNotice('Selected loans deleted.');
      successHaptic();
    } catch (err) { setNotice(err instanceof Error ? err.message : 'Could not delete selected loans.'); }
    finally { setBusy(false); }
  };
  const clearLedger = async () => {
    setBusy(true);
    try {
      await api('/api/loans', { method: 'DELETE' });
      setShowClearConfirm(false);
      setSelectedLoanIds([]);
      await refresh();
      setNotice('Ledger cleared.');
      successHaptic();
    } catch (err) { setNotice(err instanceof Error ? err.message : 'Could not clear the ledger.'); }
    finally { setBusy(false); }
  };
  const openDatePicker = () => {
    setPickerDate(dateFromInput(dueDate));
    setShowAdd(false);
    setShowDatePicker(true);
  };
  const closeDatePicker = () => {
    setShowDatePicker(false);
    setShowAdd(true);
  };
  const applyPickerDate = (date: Date) => {
    if (dateToInput(date) < today()) {
      setError('Due date can’t be in the past.');
      return;
    }
    setDueDate(dateToInput(date));
    setShowDatePicker(false);
    setShowAdd(true);
  };
  const pickReceipt = async () => {
    try {
      const permission = await ImagePicker.requestMediaLibraryPermissionsAsync();
      if (!permission.granted) { setError('Allow photo library access to attach a receipt.'); return; }
      const result = await ImagePicker.launchImageLibraryAsync({ mediaTypes: ['images'], allowsEditing: false, quality: 0.65, base64: true });
      if (!result.canceled) setReceiptAsset(result.assets[0]);
    } catch {
      setError('Could not open the photo library.');
    }
  };
  const overdueCount = useMemo(() => loans.filter((loan) => !loan.repaid && loan.dueDate < today()).length, [loans]);
  const sortedLoans = useMemo(() => {
    const sorted = [...loans];
    const direction = sortDirection === 'asc' ? 1 : -1;
    if (sortBy === 'amount') return sorted.sort((a, b) => direction * (a.amount - b.amount));
    if (sortBy === 'friend') return sorted.sort((a, b) => direction * a.friendName.localeCompare(b.friendName) || a.dueDate.localeCompare(b.dueDate));
    if (sortBy === 'repaidAt') return sorted.sort((a, b) => {
      if (a.repaid !== b.repaid) return a.repaid ? -1 : 1;
      return direction * (a.repaid ? (a.repaidAt || '').localeCompare(b.repaidAt || '') : a.dueDate.localeCompare(b.dueDate));
    });
    return sorted.sort((a, b) => direction * a.dueDate.localeCompare(b.dueDate));
  }, [loans, sortBy, sortDirection]);

  if (!loggedIn) return <SafeAreaView style={styles.safe}>
    <KeyboardAvoidingView style={styles.loginWrap} behavior={Platform.OS === 'ios' ? 'padding' : 'height'}>
      <ScrollView ref={loginScrollRef} contentContainerStyle={styles.loginScroll} keyboardShouldPersistTaps="handled" keyboardDismissMode="on-drag">
      <View style={styles.loginForm}>
        <View style={styles.loginBrand}><Avatar.Icon size={38} icon="wallet-outline" style={styles.loginBrandIcon}/><Text variant="titleMedium" style={styles.loginBrandName}>MiniLedger</Text></View>
        <LinearGradient colors={['#EEE7FF', '#D9E9FF', '#E9F5EC']} start={{ x: 0, y: 0 }} end={{ x: 1, y: 1 }} style={styles.loginArtwork}>
          <View style={styles.artRing}/><View style={styles.artCoin}><Text style={styles.artCoinText}>₹</Text></View>
          <View style={styles.artWallet}><Avatar.Icon size={86} icon="wallet-outline" color="#FFFFFF" style={styles.artWalletIcon}/><View style={styles.artWalletLine}/></View>
          <View style={styles.artSpark}><Text style={styles.artSparkText}>✦</Text></View>
        </LinearGradient>
        <Text variant="headlineLarge" style={styles.loginTitle}>{otpSent ? 'Check your code' : 'Welcome back'}</Text>
        <Text variant="bodyMedium" style={styles.loginSubtitle}>{otpSent ? `Enter the code for +91 ${phone}.` : 'Keep your lending simple and in sight.'}</Text>
        {!otpSent ? <>
          <TextInput mode="outlined" label="Phone number" value={phone} onChangeText={(v) => setPhone(v.replace(/\D/g, '').slice(0, 10))} keyboardType="phone-pad" maxLength={10} returnKeyType="done" left={<TextInput.Affix text="+91  " />} right={<TextInput.Icon icon="phone-outline"/>} style={styles.input}/>
          <HelperText type="info" visible style={styles.loginHint}>Demo sign-in · no SMS is sent</HelperText>
          <Button mode="contained" onPress={sendOtp} disabled={busy} style={styles.button} contentStyle={styles.buttonContent} labelStyle={styles.buttonLabel}>{busy ? <ActivityIndicator color="#fff"/> : 'Send code'}</Button>
        </> : <>
          <TextInput mode="outlined" label="6-digit code" value={otp} onChangeText={(v) => setOtp(v.replace(/\D/g, '').slice(0, 6))} keyboardType="number-pad" maxLength={6} returnKeyType="done" left={<TextInput.Icon icon="lock-outline"/>} style={styles.input}/>
          <HelperText type="info" visible style={styles.loginHint}>Use 123456 for this demo</HelperText>
          <Button mode="contained" onPress={verifyOtp} disabled={busy} style={styles.button} contentStyle={styles.buttonContent} labelStyle={styles.buttonLabel}>{busy ? <ActivityIndicator color="#fff"/> : 'Continue'}</Button>
          <Button mode="text" onPress={() => { setOtpSent(false); setOtp(''); setError(''); }}>Use a different number</Button>
        </>}
        <HelperText type="error" visible={!!error} style={styles.loginError}>{error}</HelperText>
      </View>
      </ScrollView>
    </KeyboardAvoidingView>
    <Snackbar visible={!!notice} onDismiss={() => setNotice('')} duration={2500}>{notice}</Snackbar>
  </SafeAreaView>;

  const repaymentProgress = summary.totalLent > 0 ? Math.min(summary.totalRepaid / summary.totalLent, 1) : 0;

  return <SafeAreaView style={styles.safe}>
    <Appbar.Header style={styles.appbar}>
      <Appbar.Content title={selectedLoanIds.length ? `${selectedLoanIds.length} selected` : 'MiniLedger'} titleStyle={styles.brandTitle}/>
      {selectedLoanIds.length > 0 ? <Appbar.Action icon="close" accessibilityLabel="Cancel selection" onPress={() => setSelectedLoanIds([])}/> : <Menu visible={showAppMenu} onDismiss={() => setShowAppMenu(false)} anchor={<Appbar.Action icon="dots-vertical" accessibilityLabel="More options" onPress={() => setShowAppMenu(true)}/> }>
        <Menu.Item leadingIcon="delete-sweep-outline" title="Clear ledger" onPress={() => { setShowAppMenu(false); setShowClearConfirm(true); }}/>
        <Menu.Item leadingIcon="logout" title="Log out" onPress={() => { setShowAppMenu(false); setLoggedIn(false); setOtpSent(false); setOtp(''); }}/>
      </Menu>}
      {selectedLoanIds.length > 0 && <Appbar.Action icon="delete-outline" accessibilityLabel="Delete selected loans" onPress={() => setShowDeleteConfirm(true)}/>}
    </Appbar.Header>
    <Animated.ScrollView style={styles.loansScroll} contentContainerStyle={styles.pageScrollContent} keyboardShouldPersistTaps="handled" bounces alwaysBounceVertical overScrollMode="always" scrollEventThrottle={16} onScroll={onHomeScroll} onScrollEndDrag={bounceDashboardNearTop}>
    <Animated.View style={[styles.dashboardFixed, { transform: [{ translateY: dashboardTranslateY }, { scaleX: dashboardScaleX }, { scaleY: dashboardScaleY }] }]}>
      <LinearGradient colors={['#52419A', '#7759C7', '#9B65C9']} start={{ x: 0, y: 0 }} end={{ x: 1, y: 1 }} style={styles.summaryCard}>
        <View style={styles.heroTop}><Text variant="labelLarge" style={styles.heroLabel}>TOTAL LENT</Text><Text variant="labelLarge" style={styles.heroBadgeText}>{loans.length} {loans.length === 1 ? 'loan' : 'loans'}</Text></View>
        <Text variant="headlineMedium" style={styles.total}>{money(summary.totalLent)}</Text>
        <View style={styles.progressCopy}><Text variant="bodySmall" style={styles.heroSub}>Repaid</Text><Text variant="bodySmall" style={styles.heroSub}>{Math.round(repaymentProgress * 100)}%</Text></View>
        <ProgressBar progress={repaymentProgress} color="#F8D66D" style={styles.progress} />
      </LinearGradient>
      <View style={styles.statRow}>
        <Card mode="contained" style={[styles.statCard, styles.repaidTile]}><Card.Content style={styles.statContent}><Avatar.Icon size={34} icon="check" style={styles.repaidIcon}/><View style={styles.statCopy}><Text variant="labelMedium" style={styles.statLabel}>REPAID</Text><Text variant="titleLarge" style={styles.statAmount}>{money(summary.totalRepaid)}</Text></View></Card.Content></Card>
        <Card mode="contained" style={[styles.statCard, overdueCount > 0 ? styles.overdueTile : styles.clearTile]}><Card.Content style={styles.statContent}><Avatar.Icon size={34} icon="clock-alert-outline" style={overdueCount > 0 ? styles.overdueIcon : styles.clearIcon}/><View style={styles.statCopy}><Text variant="labelMedium" style={styles.statLabel}>OVERDUE</Text><Text variant="titleLarge" style={[styles.statAmount, overdueCount > 0 && styles.overdue]}>{money(summary.overdueAmount)}</Text></View></Card.Content></Card>
      </View>
    </Animated.View>
    <View style={styles.loansContent}>
      <View style={styles.listHeading}>
        <View style={styles.sectionTitle}><Text variant="titleLarge" style={styles.listTitle}>Loans</Text><Text variant="labelMedium" style={styles.listCount}>{loans.length}</Text></View>
        <View style={styles.sortControls}>
        <Menu visible={showSortMenu} onDismiss={() => setShowSortMenu(false)} anchor={<Button mode="text" compact icon="sort-variant" onPress={() => setShowSortMenu(true)} style={styles.sortButton} contentStyle={styles.sortButtonContent} labelStyle={styles.sortLabel}>Sort</Button>}>
          <Menu.Item title="Due date" leadingIcon={sortBy === 'dueDate' ? 'check' : undefined} onPress={() => { setSortBy('dueDate'); setSortDirection('asc'); setShowSortMenu(false); }}/>
          <Menu.Item title="Repaid date" leadingIcon={sortBy === 'repaidAt' ? 'check' : undefined} onPress={() => { setSortBy('repaidAt'); setSortDirection('asc'); setShowSortMenu(false); }}/>
          <Menu.Item title="Amount" leadingIcon={sortBy === 'amount' ? 'check' : undefined} onPress={() => { setSortBy('amount'); setSortDirection('asc'); setShowSortMenu(false); }}/>
          <Menu.Item title="Friend name (A–Z)" leadingIcon={sortBy === 'friend' ? 'check' : undefined} onPress={() => { setSortBy('friend'); setSortDirection('asc'); setShowSortMenu(false); }}/>
        </Menu>
        <IconButton icon={sortDirection === 'asc' ? 'arrow-up' : 'arrow-down'} size={20} accessibilityLabel={sortDirection === 'asc' ? 'Ascending order. Tap to sort descending.' : 'Descending order. Tap to sort ascending.'} onPress={() => setSortDirection((direction) => direction === 'asc' ? 'desc' : 'asc')} style={styles.sortDirectionButton}/>
        </View>
      </View>
      {loans.length === 0 ? <Card mode="contained" style={styles.emptyCard}><Card.Content style={styles.emptyContent}><Text variant="titleMedium" style={styles.emptyTitle}>No loans yet</Text><Text variant="bodyMedium" style={styles.muted}>Your entries will appear here.</Text><Button mode="contained-tonal" icon="plus" onPress={() => { setError(''); setShowAdd(true); }} style={styles.emptyButton}>Add a loan</Button></Card.Content></Card> : sortedLoans.map((loan, index) => {
        const overdue = !loan.repaid && loan.dueDate < today();
        const selected = selectedLoanIds.includes(loan.id);
        const friendTotal = sortBy === 'friend' ? loans.filter((item) => item.friendName.toLocaleLowerCase() === loan.friendName.toLocaleLowerCase() && !item.repaid).reduce((sum, item) => sum + item.amount, 0) : 0;
        const startsFriendGroup = sortBy === 'friend' && (index === 0 || sortedLoans[index - 1].friendName.toLocaleLowerCase() !== loan.friendName.toLocaleLowerCase());
        return <View key={loan.id}>
        {startsFriendGroup && <View style={styles.friendHeading}><Text variant="titleMedium" style={styles.friendName}>{loan.friendName}</Text><Text variant="labelMedium" style={styles.friendTotal}>To collect {money(friendTotal)}</Text></View>}
        <Pressable onLongPress={() => toggleLoanSelection(loan.id)} delayLongPress={450}>
        <Card mode="outlined" style={[styles.loanCard, overdue && styles.overdueCard, loan.repaid && styles.repaidCard, selected && styles.selectedLoanCard]}>
          <Card.Content style={styles.loanContent}>
            <List.Item title={loan.friendName} titleStyle={[styles.loanName, loan.repaid && styles.repaidName]} description={loan.repaid ? (loan.repaidAt ? `Repaid · ${formatDate(loan.repaidAt)}` : 'Repaid') : `${overdue ? 'Overdue' : 'Due'} · ${formatDate(loan.dueDate)}`} descriptionStyle={[styles.loanDescription, overdue && styles.overdue]} left={() => <View style={styles.loanLeading}>{selectedLoanIds.length > 0 && <Pressable onPress={() => toggleLoanSelection(loan.id)}><Avatar.Icon size={28} icon={selected ? 'check-circle' : 'checkbox-blank-circle-outline'} color={selected ? '#6553A2' : '#77737D'} style={styles.selectionIcon}/></Pressable>}{loan.repaid ? <Avatar.Icon size={40} icon="check" color="#36734D" style={styles.repaidAvatar}/> : <Avatar.Text size={44} label={loan.friendName.trim().charAt(0).toUpperCase()} style={styles.avatar} labelStyle={styles.avatarLabel}/>}</View>} right={() => <View style={styles.amountCol}><Text variant="titleMedium" style={[styles.loanAmount, loan.repaid && styles.repaidAmount]}>{money(loan.amount)}</Text>{!loan.repaid && <Text variant="labelSmall" style={styles.muted}>LENT</Text>}</View>} />
            <Divider style={styles.loanDivider}/>
            <View style={styles.loanAction}>
              {selectedLoanIds.length === 0 && !loan.repaid && <Button icon="check" compact onPress={() => markRepaid(loan)}>Mark repaid</Button>}
              {selectedLoanIds.length === 0 && (loan.hasReceipt ? <Button icon="eye-outline" compact onPress={() => { setReceiptLoadFailed(false); setReceiptLoan(loan); }} accessibilityLabel={`View ${loan.friendName}'s receipt`}>View receipt</Button> : <Text variant="labelSmall" style={styles.noReceipt}>No receipt</Text>)}
            </View>
          </Card.Content>
        </Card>
        </Pressable>
        </View>;
      })}
      {sortBy === 'friend' && loans.length > 0 && <Card mode="contained" style={styles.outstandingCard}><Card.Content style={styles.outstandingContent}><Text variant="titleMedium" style={styles.outstandingLabel}>Total still to collect</Text><Text variant="titleLarge" style={styles.outstandingAmount}>{money(loans.filter((loan) => !loan.repaid).reduce((sum, loan) => sum + loan.amount, 0))}</Text></Card.Content></Card>}
    </View>
    </Animated.ScrollView>
    <FAB icon="plus" label="Add loan" style={styles.fab} onPress={() => { setError(''); setShowAdd(true); }}/>
    <Portal><Dialog visible={showAdd} onDismiss={() => setShowAdd(false)}><Dialog.Title>Add a loan</Dialog.Title><Dialog.Content style={styles.addDialogContent}><ScrollView keyboardShouldPersistTaps="handled" showsVerticalScrollIndicator={false}>
      <TextInput mode="outlined" label="Friend’s name" value={friendName} onChangeText={setFriendName} autoCapitalize="words" autoCorrect={false} spellCheck={false} autoComplete="off" style={styles.dialogInput}/>
      <TextInput mode="outlined" label="Amount (₹)" value={amount} onChangeText={setAmount} keyboardType="decimal-pad" style={styles.dialogInput}/>
      <View style={styles.dateField}>
        <Text variant="labelSmall" style={styles.dateFieldLabel}>DUE DATE</Text>
        <Button mode="outlined" icon="calendar-month-outline" onPress={openDatePicker} contentStyle={styles.dateButtonContent} style={styles.dateButton}>{formatDate(dueDate)}</Button>
      </View>
      <Button mode="contained-tonal" icon={receiptAsset ? 'check-circle-outline' : 'image-plus-outline'} onPress={pickReceipt} style={styles.receiptAttachButton}>{receiptAsset ? 'Receipt photo attached' : 'Attach a receipt photo'}</Button>
      {receiptAsset && <View style={styles.receiptPreview}><Image source={{ uri: receiptAsset.uri }} style={styles.receiptThumbnail} resizeMode="cover"/><View style={styles.receiptPreviewText}><Text variant="labelLarge" style={styles.receiptName}>Receipt ready</Text><Text variant="bodySmall" style={styles.muted}>Tap “Save loan” below to upload it</Text></View><IconButton icon="close" size={18} accessibilityLabel="Remove receipt photo" onPress={() => setReceiptAsset(null)}/></View>}
      <HelperText type="error" visible={!!error}>{error}</HelperText>
    </ScrollView></Dialog.Content><Dialog.Actions><Button onPress={() => setShowAdd(false)}>Cancel</Button><Button mode="contained" onPress={saveLoan} disabled={busy}>{busy ? 'Saving…' : 'Save loan'}</Button></Dialog.Actions></Dialog></Portal>
    {Platform.OS === 'android' && showDatePicker && <DateTimePicker value={pickerDate} minimumDate={dateFromInput(today())} mode="date" presentation="dialog" accentColor="#6553A2" positiveButton={{ label: 'Select' }} negativeButton={{ label: 'Cancel' }} onValueChange={(_, selectedDate) => applyPickerDate(selectedDate)} onDismiss={closeDatePicker}/>}
    {Platform.OS === 'ios' && <Portal><Dialog visible={showDatePicker} onDismiss={closeDatePicker}><Dialog.Title>Choose due date</Dialog.Title><Dialog.Content style={styles.datePickerContent}><DateTimePicker value={pickerDate} minimumDate={dateFromInput(today())} mode="date" display="inline" accentColor="#6553A2" onValueChange={(_, selectedDate) => setPickerDate(selectedDate)}/></Dialog.Content><Dialog.Actions><Button onPress={closeDatePicker}>Cancel</Button><Button mode="contained" onPress={() => applyPickerDate(pickerDate)}>Select date</Button></Dialog.Actions></Dialog></Portal>}
    <Portal><Dialog visible={!!receiptLoan} onDismiss={() => setReceiptLoan(null)} style={styles.receiptDialog}><Dialog.Title>Receipt</Dialog.Title><Dialog.Content>
      <Text variant="bodyMedium" style={styles.receiptFor}>{receiptLoan?.friendName}</Text>
      {receiptLoan && !receiptLoadFailed ? <Image source={{ uri: `${API}/api/loans/${receiptLoan.id}/receipt` }} style={styles.receiptImage} resizeMode="contain" onError={() => setReceiptLoadFailed(true)}/> : <Text variant="bodyMedium" style={styles.receiptError}>Couldn’t load this receipt.</Text>}
    </Dialog.Content><Dialog.Actions><Button onPress={() => setReceiptLoan(null)}>Close</Button></Dialog.Actions></Dialog></Portal>
    <Portal><Dialog visible={showClearConfirm} onDismiss={() => setShowClearConfirm(false)}><Dialog.Title>Clear the ledger?</Dialog.Title><Dialog.Content><Text variant="bodyMedium">This will permanently delete all loans and their receipt photos. This can’t be undone.</Text></Dialog.Content><Dialog.Actions><Button onPress={() => setShowClearConfirm(false)}>Cancel</Button><Button textColor="#A7382B" onPress={clearLedger} disabled={busy}>{busy ? 'Clearing…' : 'Clear ledger'}</Button></Dialog.Actions></Dialog></Portal>
    <Portal><Dialog visible={showDeleteConfirm} onDismiss={() => setShowDeleteConfirm(false)}><Dialog.Title>Delete selected loans?</Dialog.Title><Dialog.Content><Text variant="bodyMedium">Delete {selectedLoanIds.length} selected {selectedLoanIds.length === 1 ? 'loan' : 'loans'} and their receipt photos? This can’t be undone.</Text></Dialog.Content><Dialog.Actions><Button onPress={() => setShowDeleteConfirm(false)}>Cancel</Button><Button textColor="#A7382B" onPress={deleteSelectedLoans} disabled={busy}>{busy ? 'Deleting…' : 'Delete'}</Button></Dialog.Actions></Dialog></Portal>
    <Snackbar visible={!!notice} onDismiss={() => setNotice('')} duration={3000}>{notice}</Snackbar>
  </SafeAreaView>;
}

const styles = StyleSheet.create({
  safe: { flex: 1, backgroundColor: '#F7F4FC' },
  appbar: { backgroundColor: '#F7F4FC' },
  brandTitle: { fontWeight: '700', letterSpacing: -0.4, color: '#3D3945' },
  loginWrap: { flex: 1 },
  loginScroll: { flexGrow: 1, paddingHorizontal: 22, paddingTop: 12, paddingBottom: 26 },
  loginForm: { gap: 6, width: '100%', maxWidth: 440, alignSelf: 'center' },
  loginBrand: { flexDirection: 'row', alignItems: 'center', gap: 9, marginBottom: 12 },
  loginBrandIcon: { backgroundColor: '#E6DDF8' },
  loginBrandName: { color: '#3D3945', fontWeight: '700', letterSpacing: -0.3 },
  loginArtwork: { height: 190, borderRadius: 28, marginBottom: 20, alignItems: 'center', justifyContent: 'center', overflow: 'hidden' },
  artRing: { position: 'absolute', width: 176, height: 176, borderRadius: 88, borderWidth: 1, borderColor: 'rgba(101,83,162,0.18)', top: 6, left: '50%', marginLeft: -88 },
  artCoin: { position: 'absolute', top: 25, right: '19%', width: 42, height: 42, borderRadius: 16, backgroundColor: '#FFF3C9', alignItems: 'center', justifyContent: 'center', transform: [{ rotate: '10deg' }], elevation: 2 },
  artCoinText: { fontSize: 22, fontWeight: '700', color: '#9B7418' },
  artWallet: { width: 126, height: 88, borderRadius: 24, backgroundColor: '#6652A5', borderWidth: 4, borderColor: 'rgba(255,255,255,0.75)', alignItems: 'center', justifyContent: 'center', transform: [{ rotate: '-7deg' }], elevation: 5 },
  artWalletIcon: { backgroundColor: 'transparent', color: '#FFFFFF' },
  artWalletLine: { position: 'absolute', width: 36, height: 23, right: -4, top: 29, borderRadius: 9, backgroundColor: '#F0C963', borderWidth: 2, borderColor: '#FFF5D6' },
  artSpark: { position: 'absolute', left: '19%', bottom: 29, width: 34, height: 34, borderRadius: 12, backgroundColor: '#D8ECDC', alignItems: 'center', justifyContent: 'center', transform: [{ rotate: '-8deg' }] },
  artSparkText: { fontSize: 20, color: '#39805A' },
  loginTitle: { color: '#3D3945', fontWeight: '700', letterSpacing: -0.8, marginBottom: 0 },
  loginSubtitle: { color: '#706D77', lineHeight: 22, marginBottom: 10 },
  loginHint: { marginLeft: 2 },
  loginError: { marginTop: 4 },
  muted: { color: '#706D77' },
  input: { marginTop: 8, backgroundColor: '#FFFBFF' },
  button: { marginTop: 12, borderRadius: 16 },
  buttonContent: { minHeight: 48 },
  buttonLabel: { fontWeight: '700', letterSpacing: 0.2 },
  dashboardFixed: { paddingHorizontal: 18, paddingTop: 2, paddingBottom: 6, gap: 6 },
  loansScroll: { flex: 1 },
  pageScrollContent: { flexGrow: 1 },
  loansContent: { paddingHorizontal: 18, paddingTop: 2, paddingBottom: 88, gap: 10 },
  summaryCard: { minHeight: 112, borderRadius: 22, paddingHorizontal: 18, paddingVertical: 10, justifyContent: 'center', overflow: 'hidden', elevation: 2 },
  heroTop: { flexDirection: 'row', justifyContent: 'space-between', alignItems: 'center' },
  heroLabel: { color: '#F2EAFE', letterSpacing: 1, fontWeight: '700', fontSize: 12 },
  heroBadgeText: { color: '#FFFFFF', fontWeight: '600' },
  total: { color: '#FFFFFF', marginTop: 0, marginBottom: 4, fontWeight: '700', letterSpacing: -0.7 },
  progressCopy: { flexDirection: 'row', justifyContent: 'space-between', marginBottom: 3 },
  heroSub: { color: '#F3EFFF', fontWeight: '600' },
  progress: { height: 5, borderRadius: 8, backgroundColor: 'rgba(255,255,255,0.23)' },
  statRow: { flexDirection: 'row', gap: 8 },
  statCard: { flex: 1, borderRadius: 16, minHeight: 54, justifyContent: 'center' },
  repaidTile: { backgroundColor: '#E5F1E9' },
  overdueTile: { backgroundColor: '#F8E9E6' },
  clearTile: { backgroundColor: '#EBE9F6' },
  statContent: { paddingHorizontal: 10, paddingVertical: 6, flexDirection: 'row', alignItems: 'center', gap: 8 },
  repaidIcon: { backgroundColor: '#C7E3CF' },
  overdueIcon: { backgroundColor: '#F0CBC4' },
  clearIcon: { backgroundColor: '#D9D4EC' },
  statCopy: { flex: 1, minWidth: 0 },
  statLabel: { color: '#706B76', letterSpacing: 0.6, fontWeight: '700', fontSize: 10 },
  statAmount: { color: '#3D3945', fontWeight: '700', letterSpacing: -0.3, marginTop: 2 },
  overdue: { color: '#A7382B' },
  listHeading: { marginTop: 3, flexDirection: 'row', alignItems: 'center', justifyContent: 'space-between' },
  sectionTitle: { flexDirection: 'row', alignItems: 'center', gap: 9 },
  listTitle: { color: '#3D3945', fontWeight: '700' },
  listCount: { color: '#6553A2', backgroundColor: '#EADDFF', paddingHorizontal: 10, paddingVertical: 5, borderRadius: 14, overflow: 'hidden' },
  sortButton: { marginRight: -8 },
  sortButtonContent: { flexDirection: 'row-reverse' },
  sortLabel: { fontSize: 13 },
  sortControls: { flexDirection: 'row', alignItems: 'center' },
  sortDirectionButton: { margin: 0, marginLeft: -4 },
  emptyCard: { borderRadius: 22, backgroundColor: '#FFFBFF' },
  emptyContent: { alignItems: 'flex-start', padding: 20 },
  emptyTitle: { color: '#3D3945', fontWeight: '700' },
  emptyButton: { marginTop: 12, borderRadius: 18 },
  loanCard: { backgroundColor: '#FFFBFF', overflow: 'hidden', borderRadius: 18, borderColor: '#EEE9F3' },
  overdueCard: { borderColor: '#E8A79C', backgroundColor: '#FFFAF8' },
  repaidCard: { borderColor: '#D5E8DA', backgroundColor: '#F5FAF6' },
  selectedLoanCard: { borderColor: '#6553A2', borderWidth: 2, backgroundColor: '#F5F1FC' },
  loanContent: { paddingHorizontal: 6, paddingTop: 1, paddingBottom: 3 },
  loanDivider: { marginHorizontal: 8 },
  loanAction: { flexDirection: 'row', justifyContent: 'flex-end', alignItems: 'center', paddingRight: 4, paddingTop: 0, minHeight: 32 },
  loanLeading: { flexDirection: 'row', alignItems: 'center', gap: 7 },
  selectionIcon: { backgroundColor: 'transparent' },
  friendHeading: { flexDirection: 'row', justifyContent: 'space-between', alignItems: 'center', paddingHorizontal: 4, paddingTop: 8, paddingBottom: 2 },
  friendName: { color: '#45414C', fontWeight: '700' },
  friendTotal: { color: '#6553A2', fontWeight: '700' },
  outstandingCard: { borderRadius: 20, backgroundColor: '#EAE4F8', marginTop: 6 },
  outstandingContent: { flexDirection: 'row', alignItems: 'center', justifyContent: 'space-between', paddingVertical: 14 },
  outstandingLabel: { color: '#565060', fontWeight: '600' },
  outstandingAmount: { color: '#514184', fontWeight: '700' },
  loanName: { color: '#45414C', fontWeight: '700' },
  loanDescription: { color: '#706D77' },
  avatar: { backgroundColor: '#E9DDFB' },
  avatarLabel: { color: '#59468F', fontWeight: '700' },
  repaidAvatar: { backgroundColor: '#DCEFE1' },
  repaidName: { color: '#425449' },
  amountCol: { alignItems: 'flex-end', justifyContent: 'center', paddingRight: 8 },
  loanAmount: { color: '#45414C', fontWeight: '700' },
  repaidAmount: { color: '#53655A' },
  paidLabel: { color: '#39704D', fontWeight: '700' },
  noReceipt: { color: '#85818A', paddingHorizontal: 10, paddingVertical: 6 },
  fab: { position: 'absolute', right: 18, bottom: 18, borderRadius: 20 },
  dialogInput: { marginTop: 8, backgroundColor: '#FFFBFF' },
  addDialogContent: { maxHeight: 420 },
  dateField: { marginTop: 12, gap: 4 },
  dateFieldLabel: { color: '#706D77', fontWeight: '700', letterSpacing: 0.7, marginLeft: 4 },
  dateButton: { borderRadius: 12, borderColor: '#C9C4D1' },
  dateButtonContent: { minHeight: 52, flexDirection: 'row-reverse', justifyContent: 'space-between' },
  datePickerContent: { alignItems: 'center', paddingHorizontal: 0 },
  receiptAttachButton: { marginTop: 12, borderRadius: 14 },
  receiptPreview: { marginTop: 10, flexDirection: 'row', alignItems: 'center', gap: 10, borderRadius: 16, padding: 8, backgroundColor: '#F2EEF8' },
  receiptThumbnail: { width: 52, height: 52, borderRadius: 10, backgroundColor: '#E7E2EF' },
  receiptPreviewText: { flex: 1 },
  receiptName: { color: '#45414C' },
  receiptDialog: { width: '92%', maxWidth: 480, alignSelf: 'center' },
  receiptFor: { color: '#706D77', marginBottom: 12 },
  receiptImage: { width: '100%', height: 420, backgroundColor: '#F2F0F5', borderRadius: 14 },
  receiptError: { color: '#A7382B', paddingVertical: 32 },
});
