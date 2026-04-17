import { useEffect, useState, useRef, useCallback } from 'react';
import {
  View, Text, StyleSheet, FlatList, TextInput,
  TouchableOpacity, KeyboardAvoidingView, Platform,
  ActivityIndicator, Alert, Linking, Image, Modal,
  Dimensions,
} from 'react-native';
import { useLocalSearchParams, useRouter } from 'expo-router';
import { Share } from 'react-native';
import { Audio }           from 'expo-av';
import { Video, ResizeMode } from 'expo-av';
import * as Location       from 'expo-location';
import * as FileSystem     from 'expo-file-system';
import * as ImagePicker    from 'expo-image-picker';
import { supabase }        from '../src/lib/supabase';
import { COLORS }          from '../src/constants/theme';
import { useLanguage }     from '../src/hooks/useLanguage';
import type { Message }    from '../src/types';

const { width: SCREEN_W } = Dimensions.get('window');

// ─── Types ────────────────────────────────────────────────────

type JobMeta = {
  id: string;
  status: string;
  client_id: string;
  client_rating: number | null;
  request:  { title: string };
  client:   { full_name: string };
  provider: { user: { full_name: string } };
};

type RecordingState = 'idle' | 'recording' | 'uploading';

// ─── Helpers ──────────────────────────────────────────────────

function formatDuration(ms: number) {
  const s = Math.round(ms / 1000);
  const m = Math.floor(s / 60);
  const ss = s % 60;
  return `${m}:${ss.toString().padStart(2, '0')}`;
}

function formatTime(iso: string, locale: string) {
  return new Date(iso).toLocaleTimeString(locale, { hour: '2-digit', minute: '2-digit' });
}

// ─── Component ────────────────────────────────────────────────

export default function ChatScreen() {
  const { headerPad, contentPad } = useInsets();
  const router = useRouter();
  const { t, ta, lang } = useLanguage();
  const locale = lang === 'ar' ? 'ar-JO' : 'en-GB';
  const { job_id } = useLocalSearchParams<{ job_id: string }>();

  const [myId, setMyId]         = useState<string | null>(null);
  const [job, setJob]           = useState<JobMeta | null>(null);
  const [messages, setMessages] = useState<Message[]>([]);
  const [text, setText]         = useState('');
  const [loading, setLoading]   = useState(true);
  const [sending, setSending]   = useState(false);

  // Voice recording
  const [recordState, setRecordState]   = useState<RecordingState>('idle');
  const [recordDuration, setRecordDuration] = useState(0); // ms
  const recordingRef = useRef<Audio.Recording | null>(null);
  const recordTimerRef = useRef<ReturnType<typeof setInterval> | null>(null);

  // Audio playback — track which message is playing
  const [playingId, setPlayingId]       = useState<string | null>(null);
  const soundRef    = useRef<Audio.Sound | null>(null);

  // Media upload
  const [mediaUploading, setMediaUploading] = useState(false);

  // Lightbox (full-screen image/video viewer)
  const [lightbox, setLightbox] = useState<{ url: string; type: 'image' | 'video' } | null>(null);

  // Profile card sharing
  const [showProfilePicker, setShowProfilePicker] = useState(false);

  // Report modal
  const [reportModalVisible, setReportModalVisible] = useState(false);
  const [reportType, setReportType] = useState<string>('');
  const [submittingReport, setSubmittingReport] = useState(false);

  const listRef = useRef<FlatList>(null);

  // ── Load ─────────────────────────────────────────────────────

  const load = useCallback(async () => {
    if (!job_id) return;
    const { data: { user } } = await supabase.auth.getUser();
    if (!user) return;
    setMyId(user.id);

    const [{ data: jobData }, { data: msgData }] = await Promise.all([
      supabase
        .from('jobs')
        .select(`
          id, status, client_id, client_rating,
          request:requests(title),
          client:users!jobs_client_id_fkey(full_name),
          provider:providers!jobs_provider_id_fkey(user:users(full_name))
        `)
        .eq('id', job_id)
        .single(),
      supabase
        .from('messages')
        .select('*')
        .eq('job_id', job_id)
        .order('created_at', { ascending: true }),
    ]);

    if (jobData) setJob(jobData as unknown as JobMeta);
    if (msgData) setMessages(msgData as Message[]);
    setLoading(false);
  }, [job_id]);

  useEffect(() => { load(); }, [load]);

  // ── Realtime subscription ─────────────────────────────────────

  useEffect(() => {
    if (!job_id) return;
    const channel = supabase
      .channel(`chat:${job_id}`)
      .on(
        'postgres_changes',
        { event: 'INSERT', schema: 'public', table: 'messages', filter: `job_id=eq.${job_id}` },
        (payload) => {
          setMessages(prev => {
            if (prev.some(m => m.id === (payload.new as Message).id)) return prev;
            return [...prev, payload.new as Message];
          });
          setTimeout(() => listRef.current?.scrollToEnd({ animated: true }), 100);
        }
      )
      .subscribe();
    return () => { supabase.removeChannel(channel); };
  }, [job_id]);

  useEffect(() => {
    if (messages.length > 0 && !loading) {
      setTimeout(() => listRef.current?.scrollToEnd({ animated: false }), 50);
    }
  }, [loading]);

  // Cleanup sound on unmount
  useEffect(() => {
    return () => {
      soundRef.current?.unloadAsync();
      if (recordTimerRef.current) clearInterval(recordTimerRef.current);
    };
  }, []);

  // ── Send text ─────────────────────────────────────────────────

  // ── Phone number filter ───────────────────────────────────────
  // Replaces Jordanian phone numbers in outgoing messages with [رقم محجوب]

  const filterPhoneNumbers = (raw: string): string => {
    // Match common Jordanian phone patterns:
    // 00962XXXXXXXXX | +962XXXXXXXXX | 07XXXXXXXX | 7XXXXXXXX (9 digits starting with 7)
    const phoneRegex = /(\+962|00962|0)?(7[789]\d{7})/g;
    return raw.replace(phoneRegex, '[رقم محجوب]');
  };

  const sendText = async () => {
    const rawContent = text.trim();
    if (!rawContent || !myId || !job_id || sending) return;

    // Apply phone number filter before sending
    const content = filterPhoneNumbers(rawContent);

    setText('');
    setSending(true);

    const tempId = `temp-${Date.now()}`;
    const optimistic: Message = {
      id: tempId, job_id, sender_id: myId, content,
      msg_type: 'text', is_read: false, created_at: new Date().toISOString(),
    };
    setMessages(prev => [...prev, optimistic]);
    setTimeout(() => listRef.current?.scrollToEnd({ animated: true }), 50);

    const { data: inserted, error } = await supabase
      .from('messages')
      .insert({ job_id, sender_id: myId, content, msg_type: 'text' })
      .select().single();

    setSending(false);
    if (error) {
      setMessages(prev => prev.filter(m => m.id !== tempId));
      setText(content);
      return;
    }
    if (inserted) {
      setMessages(prev => prev.map(m => m.id === tempId ? inserted as Message : m));
    }
  };

  // ── Voice recording ───────────────────────────────────────────

  const startRecording = async () => {
    try {
      const { status } = await Audio.requestPermissionsAsync();
      if (status !== 'granted') {
        Alert.alert(t('chat.permissionRequired'), t('chat.micPermission'));
        return;
      }

      await Audio.setAudioModeAsync({
        allowsRecordingIOS: true,
        playsInSilentModeIOS: true,
      });

      const { recording } = await Audio.Recording.createAsync(
        Audio.RecordingOptionsPresets.HIGH_QUALITY
      );
      recordingRef.current = recording;
      setRecordState('recording');
      setRecordDuration(0);

      recordTimerRef.current = setInterval(() => {
        setRecordDuration(d => d + 100);
      }, 100);

    } catch {
      Alert.alert(t('common.error'), t('chat.errStartRecording'));
    }
  };

  const stopAndSendRecording = async () => {
    if (!recordingRef.current || !myId || !job_id) return;

    if (recordTimerRef.current) {
      clearInterval(recordTimerRef.current);
      recordTimerRef.current = null;
    }

    // Must capture duration before stopping
    const finalDuration = recordDuration;
    setRecordState('uploading');

    try {
      await recordingRef.current.stopAndUnloadAsync();
      await Audio.setAudioModeAsync({ allowsRecordingIOS: false });

      const uri = recordingRef.current.getURI();
      recordingRef.current = null;

      if (!uri || finalDuration < 500) {
        // Too short — discard
        setRecordState('idle');
        setRecordDuration(0);
        return;
      }

      // Read file as base64 and upload to Supabase Storage
      const base64 = await FileSystem.readAsStringAsync(uri, {
        encoding: FileSystem.EncodingType.Base64,
      });
      const fileName = `${myId}/${Date.now()}.m4a`;
      const byteArray = Uint8Array.from(atob(base64), c => c.charCodeAt(0));

      const { data: uploadData, error: uploadError } = await supabase.storage
        .from('chat-audio')
        .upload(fileName, byteArray, { contentType: 'audio/m4a' });

      if (uploadError) throw uploadError;

      const { data: { publicUrl } } = supabase.storage
        .from('chat-audio')
        .getPublicUrl(fileName);

      // Insert message
      const { data: inserted } = await supabase
        .from('messages')
        .insert({
          job_id,
          sender_id:   myId,
          content:     t('chat.msgVoice'),
          msg_type:    'audio',
          audio_url:   publicUrl,
          duration_ms: finalDuration,
        })
        .select().single();

      if (inserted) {
        setMessages(prev => [...prev, inserted as Message]);
        setTimeout(() => listRef.current?.scrollToEnd({ animated: true }), 100);
      }

    } catch {
      Alert.alert(t('common.error'), t('chat.errSendAudio'));
    } finally {
      setRecordState('idle');
      setRecordDuration(0);
    }
  };

  const cancelRecording = async () => {
    if (recordTimerRef.current) {
      clearInterval(recordTimerRef.current);
      recordTimerRef.current = null;
    }
    try {
      await recordingRef.current?.stopAndUnloadAsync();
      await Audio.setAudioModeAsync({ allowsRecordingIOS: false });
    } catch { /* ignore */ }
    recordingRef.current = null;
    setRecordState('idle');
    setRecordDuration(0);
  };

  // ── Audio playback ────────────────────────────────────────────

  const playAudio = async (msg: Message) => {
    if (!msg.audio_url) return;

    // Stop current playback
    if (soundRef.current) {
      await soundRef.current.unloadAsync();
      soundRef.current = null;
    }

    if (playingId === msg.id) {
      setPlayingId(null);
      return;
    }

    try {
      setPlayingId(msg.id);
      await Audio.setAudioModeAsync({ allowsRecordingIOS: false, playsInSilentModeIOS: true });
      const { sound } = await Audio.Sound.createAsync(
        { uri: msg.audio_url },
        { shouldPlay: true }
      );
      soundRef.current = sound;
      sound.setOnPlaybackStatusUpdate(status => {
        if (status.isLoaded && status.didJustFinish) {
          setPlayingId(null);
          sound.unloadAsync();
        }
      });
    } catch {
      setPlayingId(null);
      Alert.alert(t('common.error'), t('chat.errPlayAudio'));
    }
  };

  // ── Location ──────────────────────────────────────────────────

  const sendLocation = async () => {
    if (!myId || !job_id) return;

    const { status } = await Location.requestForegroundPermissionsAsync();
    if (status !== 'granted') {
      Alert.alert(t('chat.permissionRequired'), t('chat.locationPermission'));
      return;
    }

    setSending(true);
    try {
      const loc = await Location.getCurrentPositionAsync({
        accuracy: Location.Accuracy.Balanced,
      });

      const { latitude, longitude } = loc.coords;

      // Reverse geocode for a human-readable label
      const [geo] = await Location.reverseGeocodeAsync({ latitude, longitude });
      const label = [geo?.street, geo?.district, geo?.city]
        .filter(Boolean).join(lang === 'ar' ? '، ' : ', ') || t('chat.currentLocation');

      const { data: inserted } = await supabase
        .from('messages')
        .insert({
          job_id,
          sender_id:      myId,
          content:        `📍 ${label}`,
          msg_type:       'location',
          latitude,
          longitude,
          location_label: label,
        })
        .select().single();

      if (inserted) {
        setMessages(prev => [...prev, inserted as Message]);
        setTimeout(() => listRef.current?.scrollToEnd({ animated: true }), 100);
      }
    } catch {
      Alert.alert(t('common.error'), t('chat.errGetLocation'));
    } finally {
      setSending(false);
    }
  };

  // ── Media (image / video) ─────────────────────────────────────

  const sendMedia = async (mediaType: 'image' | 'video') => {
    if (!myId || !job_id) return;

    // Ask for permission
    const { status } = await ImagePicker.requestMediaLibraryPermissionsAsync();
    if (status !== 'granted') {
      Alert.alert(t('chat.permissionRequired'), t('chat.mediaPermission'));
      return;
    }

    const result = await ImagePicker.launchImageLibraryAsync({
      mediaTypes: mediaType === 'image'
        ? ImagePicker.MediaTypeOptions.Images
        : ImagePicker.MediaTypeOptions.Videos,
      quality: 0.85,
      allowsEditing: false,
      videoMaxDuration: 120, // 2 min cap for videos
    });

    if (result.canceled || !result.assets?.length) return;

    const asset = result.assets[0];
    const uri   = asset.uri;
    const isVideo = mediaType === 'video';

    setMediaUploading(true);

    try {
      const ext = uri.split('.').pop()?.toLowerCase() ?? (isVideo ? 'mp4' : 'jpg');
      const mime = isVideo
        ? (ext === 'mov' ? 'video/quicktime' : 'video/mp4')
        : (ext === 'png' ? 'image/png' : 'image/jpeg');

      const fileName  = `${myId}/${Date.now()}.${ext}`;
      const base64    = await FileSystem.readAsStringAsync(uri, {
        encoding: FileSystem.EncodingType.Base64,
      });
      const byteArray = Uint8Array.from(atob(base64), c => c.charCodeAt(0));

      const { error: uploadError } = await supabase.storage
        .from('chat-media')
        .upload(fileName, byteArray, { contentType: mime });

      if (uploadError) throw uploadError;

      const { data: { publicUrl } } = supabase.storage
        .from('chat-media')
        .getPublicUrl(fileName);

      const insertPayload = isVideo
        ? {
            job_id,
            sender_id: myId,
            content:   t('chat.msgVideo'),
            msg_type:  'video' as const,
            video_url: publicUrl,
          }
        : {
            job_id,
            sender_id: myId,
            content:   t('chat.msgImage'),
            msg_type:  'image' as const,
            image_url: publicUrl,
          };

      const { data: inserted } = await supabase
        .from('messages')
        .insert(insertPayload)
        .select().single();

      if (inserted) {
        setMessages(prev => [...prev, inserted as Message]);
        setTimeout(() => listRef.current?.scrollToEnd({ animated: true }), 100);
      }
    } catch {
      Alert.alert(t('common.error'), t('chat.errSendMedia'));
    } finally {
      setMediaUploading(false);
    }
  };

  // ── Send profile card (in-chat) ──────────────────────────────

  const sendProfileCard = async (providerId: string, providerName: string) => {
    if (!myId || !job_id) return;
    setSending(true);
    try {
      const { data: inserted } = await supabase
        .from('messages')
        .insert({
          job_id,
          sender_id:          myId,
          content:            t('chat.msgShareProfile', { name: providerName }),
          msg_type:           'profile_card',
          shared_provider_id: providerId,
        })
        .select().single();

      if (inserted) {
        setMessages(prev => [...prev, inserted as Message]);
        setTimeout(() => listRef.current?.scrollToEnd({ animated: true }), 100);
      }

      // Track share event
      supabase.rpc('record_profile_share', {
        p_provider_id: providerId,
        p_shared_by:   myId,
        p_channel:     'chat',
      }).catch(() => {});

    } catch {
      Alert.alert(t('common.error'), t('chat.errSendProfile'));
    } finally {
      setSending(false);
      setShowProfilePicker(false);
    }
  };

  // Open provider profile picker — for now shares the job's provider
  const shareCurrentProvider = async () => {
    if (!job) return;
    // Get provider_id from job
    const { data: jobFull } = await supabase
      .from('jobs')
      .select('provider_id, provider:providers(id, user:users(full_name))')
      .eq('id', job_id)
      .single();
    if (!jobFull) return;
    const pid  = jobFull.provider_id;
    const name = (jobFull as any).provider?.user?.full_name ?? t('chat.defaultProviderName');

    Alert.alert(
      t('chat.shareProfile'),
      t('chat.shareProfilePrompt', { name }),
      [
        { text: t('common.cancel'), style: 'cancel' },
        { text: t('chat.shareInChat'), onPress: () => sendProfileCard(pid, name) },
        {
          text: t('chat.shareExternal'),
          onPress: async () => {
            const { data: prov } = await supabase
              .from('providers')
              .select('username')
              .eq('id', pid)
              .single();
            const link = `https://waseet.app/p/${prov?.username ?? pid}`;
            await Share.share({ message: t('chat.recommendMsg', { name, link }), url: link });
            supabase.rpc('record_profile_share', {
              p_provider_id: pid,
              p_shared_by:   myId,
              p_channel:     'other',
            }).catch(() => {});
          },
        },
      ]
    );
  };

  const openMap = (lat: number, lng: number, label?: string) => {
    const encoded = encodeURIComponent(label ?? '');
    const url = Platform.OS === 'ios'
      ? `maps://?ll=${lat},${lng}&q=${encoded}`
      : `geo:${lat},${lng}?q=${lat},${lng}(${encoded})`;
    Linking.openURL(url).catch(() =>
      Linking.openURL(`https://maps.google.com/?q=${lat},${lng}`)
    );
  };

  // ── Submit report ─────────────────────────────────────────────

  const submitReport = async () => {
    if (!reportType || !job) return;
    const otherUserId = myId === job.client_id
      ? job.provider?.user?.full_name  // we need the actual provider_id
      : job.client_id;

    // Fetch the other user's ID from the job
    const { data: jobFull } = await supabase
      .from('jobs')
      .select('client_id, provider_id')
      .eq('id', job_id)
      .single();
    if (!jobFull) return;

    const reportedId = myId === jobFull.client_id ? jobFull.provider_id : jobFull.client_id;

    setSubmittingReport(true);
    const { data, error } = await supabase.rpc('submit_report', {
      p_reported_user_id: reportedId,
      p_report_type:      reportType,
      p_job_id:           job_id,
    });
    setSubmittingReport(false);

    if (error || data?.error) {
      Alert.alert(t('common.error'), data?.error === 'ALREADY_REPORTED'
        ? t('report.alreadyReported')
        : t('report.submitFailed'));
      return;
    }

    setReportModalVisible(false);
    setReportType('');
    Alert.alert(t('report.successTitle'), t('report.successMsg'));
  };

  // ── Render helpers ────────────────────────────────────────────

  const otherPartyName = (): string => {
    if (!job) return '';
    return job.provider?.user?.full_name ?? job.client?.full_name ?? '';
  };

  const isJobClosed = job?.status === 'completed'
    || job?.status === 'cancelled'
    || job?.status === 'disputed';

  // ── Message bubble renderer ───────────────────────────────────

  const renderMessage = ({ item, index }: { item: Message; index: number }) => {
    const isMine = item.sender_id === myId;
    const prevMsg = messages[index - 1];
    const showTime =
      !prevMsg ||
      new Date(item.created_at).getTime() - new Date(prevMsg.created_at).getTime() > 5 * 60 * 1000;

    return (
      <View>
        {showTime && (
          <Text style={styles.timeLabel}>
            {new Date(item.created_at).toLocaleDateString(locale, {
              weekday: 'short', hour: '2-digit', minute: '2-digit',
            })}
          </Text>
        )}
        <View style={[styles.bubbleRow, isMine ? styles.bubbleRowMine : styles.bubbleRowTheirs]}>

          {/* ── Audio bubble ── */}
          {item.msg_type === 'audio' && item.audio_url ? (
            <TouchableOpacity
              style={[styles.bubble, styles.audioBubble, isMine ? styles.bubbleMine : styles.bubbleTheirs]}
              onPress={() => playAudio(item)}
              activeOpacity={0.8}
            >
              <View style={styles.audioInner}>
                <View style={[styles.playBtn, isMine ? styles.playBtnMine : styles.playBtnTheirs]}>
                  <Text style={styles.playBtnIcon}>
                    {playingId === item.id ? '⏸' : '▶'}
                  </Text>
                </View>
                <View style={styles.audioWave}>
                  {[...Array(12)].map((_, i) => (
                    <View
                      key={i}
                      style={[
                        styles.waveBar,
                        { height: 6 + Math.sin(i * 0.8) * 10 },
                        isMine ? styles.waveBarMine : styles.waveBarTheirs,
                        playingId === item.id && styles.waveBarPlaying,
                      ]}
                    />
                  ))}
                </View>
                {item.duration_ms ? (
                  <Text style={[styles.audioDuration, isMine ? styles.audioDurationMine : styles.audioDurationTheirs]}>
                    {formatDuration(item.duration_ms)}
                  </Text>
                ) : null}
              </View>
              <Text style={[styles.bubbleTime, isMine ? styles.bubbleTimeMine : styles.bubbleTimeTheirs]}>
                {formatTime(item.created_at, locale)}
              </Text>
            </TouchableOpacity>

          /* ── Location bubble ── */
          ) : item.msg_type === 'location' && item.latitude && item.longitude ? (
            <TouchableOpacity
              style={[styles.bubble, styles.locationBubble, isMine ? styles.bubbleMine : styles.bubbleTheirs]}
              onPress={() => openMap(item.latitude!, item.longitude!, item.location_label)}
              activeOpacity={0.8}
            >
              <View style={styles.locationMapPreview}>
                <Text style={styles.locationMapPin}>📍</Text>
                <Text style={styles.locationMapCoords}>
                  {item.latitude?.toFixed(4)}, {item.longitude?.toFixed(4)}
                </Text>
              </View>
              <Text style={[styles.locationLabel, isMine ? styles.locationLabelMine : styles.locationLabelTheirs]}
                numberOfLines={2}
              >
                {item.location_label ?? t('chat.currentLocation')}
              </Text>
              <Text style={[styles.locationTap, isMine ? styles.locationTapMine : styles.locationTapTheirs]}>
                {t('chat.tapToOpenMap')}
              </Text>
              <Text style={[styles.bubbleTime, isMine ? styles.bubbleTimeMine : styles.bubbleTimeTheirs]}>
                {formatTime(item.created_at, locale)}
              </Text>
            </TouchableOpacity>

          /* ── Image bubble ── */
          ) : item.msg_type === 'image' && item.image_url ? (
            <TouchableOpacity
              style={[styles.mediaBubble, isMine ? styles.bubbleMine : styles.bubbleTheirs]}
              onPress={() => setLightbox({ url: item.image_url!, type: 'image' })}
              activeOpacity={0.9}
            >
              <Image
                source={{ uri: item.image_url }}
                style={styles.mediaThumb}
                resizeMode="cover"
              />
              <Text style={[styles.bubbleTime, styles.mediaTime, isMine ? styles.bubbleTimeMine : styles.bubbleTimeTheirs]}>
                {formatTime(item.created_at, locale)}
              </Text>
            </TouchableOpacity>

          /* ── Video bubble ── */
          ) : item.msg_type === 'video' && item.video_url ? (
            <TouchableOpacity
              style={[styles.mediaBubble, isMine ? styles.bubbleMine : styles.bubbleTheirs]}
              onPress={() => setLightbox({ url: item.video_url!, type: 'video' })}
              activeOpacity={0.9}
            >
              <View style={styles.videoThumbWrap}>
                <Video
                  source={{ uri: item.video_url }}
                  style={styles.mediaThumb}
                  resizeMode={ResizeMode.COVER}
                  shouldPlay={false}
                  isMuted
                />
                <View style={styles.videoPlayOverlay}>
                  <Text style={styles.videoPlayIcon}>▶</Text>
                </View>
              </View>
              <Text style={[styles.bubbleTime, styles.mediaTime, isMine ? styles.bubbleTimeMine : styles.bubbleTimeTheirs]}>
                {formatTime(item.created_at, locale)}
              </Text>
            </TouchableOpacity>

          /* ── Profile card bubble ── */
          ) : item.msg_type === 'profile_card' && item.shared_provider_id ? (
            <ProfileCardBubble
              message={item}
              isMine={isMine}
              onView={() => router.push({
                pathname: '/provider-profile',
                params: { provider_id: item.shared_provider_id },
              })}
            />

          /* ── Text bubble ── */
          ) : (
            <View style={[styles.bubble, isMine ? styles.bubbleMine : styles.bubbleTheirs]}>
              <Text style={[styles.bubbleText, isMine ? styles.bubbleTextMine : styles.bubbleTextTheirs]}>
                {item.content}
              </Text>
              <Text style={[styles.bubbleTime, isMine ? styles.bubbleTimeMine : styles.bubbleTimeTheirs]}>
                {formatTime(item.created_at, locale)}
              </Text>
            </View>
          )}
        </View>
      </View>
    );
  };

  // ── Render ────────────────────────────────────────────────────

  if (loading) {
    return (
      <View style={styles.center}>
        <ActivityIndicator color={COLORS.accent} size="large" />
      </View>
    );
  }

  return (
    <KeyboardAvoidingView
      style={styles.container}
      behavior={Platform.OS === 'ios' ? 'padding' : 'height'}
      keyboardVerticalOffset={0}
    >
      {/* ── Lightbox modal ── */}
      <Modal
        visible={!!lightbox}
        transparent
        animationType="fade"
        onRequestClose={() => setLightbox(null)}
      >
        <TouchableOpacity
          style={styles.lightboxBackdrop}
          activeOpacity={1}
          onPress={() => setLightbox(null)}
        >
          {lightbox?.type === 'image' ? (
            <Image
              source={{ uri: lightbox.url }}
              style={styles.lightboxImage}
              resizeMode="contain"
            />
          ) : lightbox?.type === 'video' ? (
            <Video
              source={{ uri: lightbox.url }}
              style={styles.lightboxVideo}
              resizeMode={ResizeMode.CONTAIN}
              shouldPlay
              useNativeControls
            />
          ) : null}
          <TouchableOpacity
            style={[styles.lightboxClose, { top: headerPad }]}
            onPress={() => setLightbox(null)}
          >
            <Text style={styles.lightboxCloseText}>✕</Text>
          </TouchableOpacity>
        </TouchableOpacity>
      </Modal>
      {/* ── Report modal ── */}
      <Modal
        visible={reportModalVisible}
        animationType="slide"
        transparent
        onRequestClose={() => setReportModalVisible(false)}
      >
        <View style={styles.reportOverlay}>
          <View style={[styles.reportSheet, { paddingBottom: contentPad }]}>
            <Text style={styles.reportTitle}>{t('report.title')}</Text>
            <Text style={styles.reportSubtitle}>{t('report.subtitle')}</Text>
            {(['no_show', 'fake_bid', 'abusive', 'spam', 'other'] as const).map(type => (
              <TouchableOpacity
                key={type}
                style={[styles.reportOption, reportType === type && styles.reportOptionSelected]}
                onPress={() => setReportType(type)}
              >
                <View style={[styles.reportRadio, reportType === type && styles.reportRadioSelected]} />
                <Text style={[styles.reportOptionText, reportType === type && styles.reportOptionTextSelected]}>
                  {t(`report.type_${type}`)}
                </Text>
              </TouchableOpacity>
            ))}
            <View style={styles.reportBtns}>
              <TouchableOpacity style={styles.reportCancelBtn} onPress={() => setReportModalVisible(false)}>
                <Text style={styles.reportCancelText}>{t('common.cancel')}</Text>
              </TouchableOpacity>
              <TouchableOpacity
                style={[styles.reportSubmitBtn, (!reportType || submittingReport) && styles.reportSubmitDisabled]}
                onPress={submitReport}
                disabled={!reportType || submittingReport}
              >
                <Text style={styles.reportSubmitText}>
                  {submittingReport ? t('common.loading') : t('report.submit')}
                </Text>
              </TouchableOpacity>
            </View>
          </View>
        </View>
      </Modal>

      {/* ── Header ── */}
      <View style={styles.header}>
        <TouchableOpacity style={styles.backBtn} onPress={() => router.back()}>
          <Text style={styles.backText}>→</Text>
        </TouchableOpacity>
        <View style={styles.headerInfo}>
          <Text style={styles.headerTitle} numberOfLines={1}>{job?.request?.title ?? t('chat.defaultChatTitle')}</Text>
          <Text style={styles.headerSub} numberOfLines={1}>{otherPartyName()}</Text>
        </View>
        <TouchableOpacity style={styles.backBtn} onPress={() => setReportModalVisible(true)}>
          <Text style={{ fontSize: 18 }}>🚩</Text>
        </TouchableOpacity>
      </View>

      {/* ── Messages ── */}
      <FlatList
        ref={listRef}
        data={messages}
        keyExtractor={item => item.id}
        contentContainerStyle={styles.listContent}
        showsVerticalScrollIndicator={false}
        ListEmptyComponent={
          <View style={styles.emptyChat}>
            <Text style={styles.emptyChatIcon}>💬</Text>
            <Text style={styles.emptyChatText}>{t('chat.noMessages')}</Text>
            <Text style={styles.emptyChatSub}>{t('chat.noMessagesSub')}</Text>
          </View>
        }
        renderItem={renderMessage}
      />

      {/* ── Recording HUD ── */}
      {recordState === 'recording' && (
        <View style={[styles.recordingHud, { paddingBottom: contentPad }]}>
          <TouchableOpacity style={styles.cancelRecordBtn} onPress={cancelRecording}>
            <Text style={styles.cancelRecordText}>{t('chat.cancelRecord')}</Text>
          </TouchableOpacity>
          <View style={styles.recordingInfo}>
            <View style={styles.recordingDot} />
            <Text style={styles.recordingDuration}>{formatDuration(recordDuration)}</Text>
          </View>
          <TouchableOpacity style={styles.sendRecordBtn} onPress={stopAndSendRecording}>
            <Text style={styles.sendRecordText}>{t('chat.sendRecord')}</Text>
          </TouchableOpacity>
        </View>
      )}

      {/* ── Input bar ── */}
      {isJobClosed ? (
        <View style={[styles.closedBar, { paddingBottom: contentPad }]}>
          <Text style={styles.closedBarText}>
            {job?.status === 'completed' ? t('chat.completedJob') : t('chat.closedConv')}
          </Text>
          {job?.status === 'completed'
            && myId === job?.client_id
            && !job?.client_rating && (
            <TouchableOpacity
              style={styles.rateBtn}
              onPress={() => router.push({
                pathname: '/rate-job',
                params: {
                  job_id: job.id,
                  provider_name: job.provider?.user?.full_name ?? '',
                },
              })}
            >
              <Text style={styles.rateBtnText}>{t('chat.rateProvider')}</Text>
            </TouchableOpacity>
          )}
        </View>
      ) : recordState === 'uploading' || mediaUploading ? (
        <View style={[styles.uploadingBar, { paddingBottom: contentPad }]}>
          <ActivityIndicator color={COLORS.accent} size="small" />
          <Text style={styles.uploadingText}>
            {mediaUploading ? t('chat.uploadingFile') : t('chat.sendingAudio')}
          </Text>
        </View>
      ) : recordState === 'idle' ? (
        <View style={[styles.inputBar, { paddingBottom: contentPad }]}>
          {/* Location button */}
          <TouchableOpacity
            style={styles.mediaBtn}
            onPress={sendLocation}
            disabled={sending}
          >
            <Text style={styles.mediaBtnIcon}>📍</Text>
          </TouchableOpacity>

          {/* Voice button (hold to record) */}
          <TouchableOpacity
            style={styles.mediaBtn}
            onLongPress={startRecording}
            onPressOut={() => {
              if (recordState === 'recording') stopAndSendRecording();
            }}
            delayLongPress={200}
          >
            <Text style={styles.mediaBtnIcon}>🎤</Text>
          </TouchableOpacity>

          {/* Media (image / video) button */}
          <TouchableOpacity
            style={styles.mediaBtn}
            onPress={() =>
              Alert.alert(
                t('chat.mediaAttachTitle'),
                t('chat.mediaChooseType'),
                [
                  { text: t('chat.mediaImage'),          onPress: () => sendMedia('image') },
                  { text: t('chat.mediaVideo'),          onPress: () => sendMedia('video') },
                  { text: t('chat.mediaProviderProfile'), onPress: shareCurrentProvider },
                  { text: t('common.cancel'), style: 'cancel' },
                ]
              )
            }
            disabled={sending || mediaUploading}
          >
            <Text style={styles.mediaBtnIcon}>📎</Text>
          </TouchableOpacity>

          {/* Text input */}
          <TextInput
            style={styles.input}
            placeholder={t('chat.typePlaceholder')}
            placeholderTextColor={COLORS.textMuted}
            value={text}
            onChangeText={setText}
            textAlign="right"
            multiline
            maxLength={500}
          />

          {/* Send button */}
          <TouchableOpacity
            style={[styles.sendBtn, (!text.trim() || sending) && styles.sendBtnDisabled]}
            onPress={sendText}
            disabled={!text.trim() || sending}
          >
            {sending
              ? <ActivityIndicator color={COLORS.bg} size="small" />
              : <Text style={styles.sendBtnText}>{t('chat.sendBtn')}</Text>
            }
          </TouchableOpacity>
        </View>
      ) : null}

      {/* Hint for voice */}
      {recordState === 'idle' && !isJobClosed && (
        <Text style={styles.voiceHint}>{t('chat.voiceHint')}</Text>
      )}
    </KeyboardAvoidingView>
  );
}

// ─── Profile Card Bubble ─────────────────────────────────────

type ProviderSnap = {
  id: string;
  score: number;
  reputation_tier: string;
  badge_verified: boolean;
  lifetime_jobs: number;
  username?: string;
  user: { full_name: string; city: string };
};

function ProfileCardBubble({
  message,
  isMine,
  onView,
}: {
  message: Message;
  isMine: boolean;
  onView: () => void;
}) {
  const { t, lang } = useLanguage();
  const locale = lang === 'ar' ? 'ar-JO' : 'en-GB';
  const [prov, setProv] = useState<ProviderSnap | null>(null);

  useEffect(() => {
    if (!message.shared_provider_id) return;
    supabase
      .from('providers')
      .select('id, score, reputation_tier, badge_verified, lifetime_jobs, username, user:users(full_name, city)')
      .eq('id', message.shared_provider_id)
      .single()
      .then(({ data }) => { if (data) setProv(data as ProviderSnap); });
  }, [message.shared_provider_id]);

  const tierColor = prov
    ? (TIER_META_COLORS[prov.reputation_tier] ?? '#94A3B8')
    : '#94A3B8';

  const TIER_META_COLORS: Record<string, string> = {
    new: '#94A3B8', rising: '#60A5FA', trusted: '#34D399', expert: '#FBBF24', elite: '#F472B6',
  };
  return (
    <View style={[pcStyles.card, isMine ? pcStyles.cardMine : pcStyles.cardTheirs]}>
      {/* Header */}
      <View style={pcStyles.header}>
        <View style={[pcStyles.avatar, { backgroundColor: tierColor + '33' }]}>
          <Text style={[pcStyles.avatarText, { color: tierColor }]}>
            {prov?.user?.full_name?.charAt(0) ?? '?'}
          </Text>
        </View>
        <View style={pcStyles.info}>
          {prov ? (
            <>
              <Text style={pcStyles.name}>{prov.user.full_name}</Text>
              <Text style={pcStyles.city}>📍 {prov.user.city}</Text>
              <View style={pcStyles.badgeRow}>
                <View style={[pcStyles.tier, { backgroundColor: tierColor + '22' }]}>
                  <Text style={[pcStyles.tierText, { color: tierColor }]}>
                    {t(`dashboard.tier${prov.reputation_tier.charAt(0).toUpperCase() + prov.reputation_tier.slice(1)}` as any)}
                  </Text>
                </View>
                {prov.badge_verified && (
                  <Text style={pcStyles.verified}>{t('providerProfile.verified')}</Text>
                )}
              </View>
            </>
          ) : (
            <ActivityIndicator color={COLORS.accent} size="small" />
          )}
        </View>
      </View>

      {/* Stats */}
      {prov && (
        <View style={pcStyles.statsRow}>
          {prov.score > 0 && <Text style={pcStyles.stat}>⭐ {prov.score.toFixed(1)}</Text>}
          <Text style={pcStyles.stat}>🔨 {t('chat.jobsCount', { count: prov.lifetime_jobs })}</Text>
        </View>
      )}

      {/* Actions */}
      <TouchableOpacity style={pcStyles.viewBtn} onPress={onView} activeOpacity={0.85}>
        <Text style={pcStyles.viewBtnText}>{t('chat.viewFullProfile')}</Text>
      </TouchableOpacity>

      <Text style={pcStyles.time}>{formatTime(message.created_at, locale)}</Text>
    </View>
  );
}

// Import TIER_META for colors — inline map used above, import needed for type safety
import { TIER_META } from '../src/constants/categories';
import { useInsets } from '../src/hooks/useInsets';
import { HEADER_PAD } from '../src/utils/layout';

const pcStyles = StyleSheet.create({
  card:       { borderRadius: 16, padding: 14, maxWidth: SCREEN_W * 0.78, minWidth: 220, borderWidth: 1 },
  cardMine:   { backgroundColor: '#1C1A0E', borderColor: '#78350F', alignSelf: 'flex-end' },
  cardTheirs: { backgroundColor: COLORS.surface, borderColor: COLORS.border, alignSelf: 'flex-start' },

  header:     { flexDirection: 'row', gap: 10, alignItems: 'flex-start', marginBottom: 10 },
  avatar:     { width: 44, height: 44, borderRadius: 22, alignItems: 'center', justifyContent: 'center', flexShrink: 0 },
  avatarText: { fontSize: 18, fontWeight: '800' },
  info:       { flex: 1 },
  name:       { fontSize: 14, fontWeight: '700', color: COLORS.textPrimary, textAlign: 'right', marginBottom: 2 },
  city:       { fontSize: 11, color: COLORS.textMuted, textAlign: 'right', marginBottom: 4 },
  badgeRow:   { flexDirection: 'row', gap: 6, justifyContent: 'flex-end' },
  tier:       { borderRadius: 6, paddingHorizontal: 6, paddingVertical: 2 },
  tierText:   { fontSize: 10, fontWeight: '700' },
  verified:   { fontSize: 10, color: '#7DD3FC', fontWeight: '700' },

  statsRow: { flexDirection: 'row', gap: 12, justifyContent: 'flex-end', marginBottom: 10 },
  stat:     { fontSize: 12, color: COLORS.textSecondary },

  viewBtn:     { backgroundColor: COLORS.accent, borderRadius: 10, paddingVertical: 9, alignItems: 'center' },
  viewBtnText: { fontSize: 12, fontWeight: '700', color: COLORS.bg },

  time: { fontSize: 10, color: COLORS.textMuted, textAlign: 'right', marginTop: 6 },
});

// ─── Styles ───────────────────────────────────────────────────

const styles = StyleSheet.create({
  container: { flex: 1, backgroundColor: COLORS.bg },
  center:    { flex: 1, backgroundColor: COLORS.bg, alignItems: 'center', justifyContent: 'center' },

  header:      { flexDirection: 'row', alignItems: 'center', paddingHorizontal: 16, paddingTop: HEADER_PAD, paddingBottom: 14, borderBottomWidth: 1, borderBottomColor: COLORS.border, gap: 12 },
  backBtn:     { width: 36, height: 36, alignItems: 'center', justifyContent: 'center' },
  backText:    { fontSize: 22, color: COLORS.textSecondary, transform: [{ scaleX: -1 }] },
  headerInfo:  { flex: 1 },
  headerTitle: { fontSize: 15, fontWeight: '700', color: COLORS.textPrimary, textAlign: 'center' },
  headerSub:   { fontSize: 12, color: COLORS.textMuted, textAlign: 'center', marginTop: 2 },

  listContent: { padding: 16, paddingBottom: 8, flexGrow: 1, justifyContent: 'flex-end' },

  emptyChat:     { flex: 1, alignItems: 'center', justifyContent: 'center', paddingVertical: 60 },
  emptyChatIcon: { fontSize: 48, marginBottom: 12 },
  emptyChatText: { fontSize: 16, fontWeight: '600', color: COLORS.textPrimary, marginBottom: 6 },
  emptyChatSub:  { fontSize: 13, color: COLORS.textMuted },

  timeLabel: { fontSize: 11, color: COLORS.textMuted, textAlign: 'center', marginVertical: 10 },

  bubbleRow:       { marginBottom: 4, flexDirection: 'row' },
  bubbleRowMine:   { justifyContent: 'flex-end' },
  bubbleRowTheirs: { justifyContent: 'flex-start' },

  bubble:       { maxWidth: '78%', borderRadius: 18, paddingHorizontal: 14, paddingVertical: 10 },
  bubbleMine:   { backgroundColor: COLORS.accent, borderBottomRightRadius: 4 },
  bubbleTheirs: { backgroundColor: COLORS.surface, borderBottomLeftRadius: 4, borderWidth: 1, borderColor: COLORS.border },

  bubbleText:       { fontSize: 15, lineHeight: 22 },
  bubbleTextMine:   { color: COLORS.bg },
  bubbleTextTheirs: { color: COLORS.textPrimary },

  bubbleTime:       { fontSize: 10, marginTop: 4 },
  bubbleTimeMine:   { color: '#78350F', textAlign: 'right' },
  bubbleTimeTheirs: { color: COLORS.textMuted, textAlign: 'right' },

  // ── Audio bubble ──
  audioBubble: { paddingVertical: 12, paddingHorizontal: 12, minWidth: 180 },
  audioInner:  { flexDirection: 'row', alignItems: 'center', gap: 8, marginBottom: 4 },
  playBtn:     { width: 36, height: 36, borderRadius: 18, alignItems: 'center', justifyContent: 'center' },
  playBtnMine: { backgroundColor: '#78350F' },
  playBtnTheirs:{ backgroundColor: COLORS.border },
  playBtnIcon: { fontSize: 14 },
  audioWave:   { flex: 1, flexDirection: 'row', alignItems: 'center', gap: 2 },
  waveBar:     { width: 3, borderRadius: 2 },
  waveBarMine: { backgroundColor: '#78350F' },
  waveBarTheirs:{ backgroundColor: COLORS.border },
  waveBarPlaying:{ backgroundColor: COLORS.bg },
  audioDuration:      { fontSize: 11, fontWeight: '600' },
  audioDurationMine:  { color: '#78350F' },
  audioDurationTheirs:{ color: COLORS.textMuted },

  // ── Image / Video bubble ──
  mediaBubble:      { maxWidth: '72%', borderRadius: 16, overflow: 'hidden', padding: 0 },
  mediaThumb:       { width: SCREEN_W * 0.6, height: SCREEN_W * 0.6 * 0.75, borderRadius: 14 },
  mediaTime:        { paddingHorizontal: 10, paddingBottom: 6, paddingTop: 4 },
  videoThumbWrap:   { position: 'relative' },
  videoPlayOverlay: { position: 'absolute', top: 0, left: 0, right: 0, bottom: 0, alignItems: 'center', justifyContent: 'center', backgroundColor: 'rgba(0,0,0,0.35)' },
  videoPlayIcon:    { fontSize: 32, color: '#fff' },

  // ── Lightbox ──
  lightboxBackdrop: { flex: 1, backgroundColor: 'rgba(0,0,0,0.95)', alignItems: 'center', justifyContent: 'center' },
  lightboxImage:    { width: SCREEN_W, height: SCREEN_W * 1.2 },
  lightboxVideo:    { width: SCREEN_W, height: SCREEN_W * 0.7 },
  lightboxClose:    { position: 'absolute', top: 20, right: 20, width: 40, height: 40, borderRadius: 20, backgroundColor: 'rgba(255,255,255,0.15)', alignItems: 'center', justifyContent: 'center' },
  lightboxCloseText:{ fontSize: 18, color: '#fff', fontWeight: '700' },

  // ── Location bubble ──
  locationBubble:      { paddingVertical: 12, paddingHorizontal: 12, minWidth: 200 },
  locationMapPreview:  { flexDirection: 'row', alignItems: 'center', gap: 6, backgroundColor: 'rgba(0,0,0,0.15)', borderRadius: 10, padding: 8, marginBottom: 8 },
  locationMapPin:      { fontSize: 22 },
  locationMapCoords:   { fontSize: 10, color: COLORS.textMuted, fontFamily: Platform.OS === 'ios' ? 'Courier' : 'monospace' },
  locationLabel:       { fontSize: 13, fontWeight: '600', marginBottom: 4, lineHeight: 18 },
  locationLabelMine:   { color: COLORS.bg },
  locationLabelTheirs: { color: COLORS.textPrimary },
  locationTap:         { fontSize: 11, marginBottom: 4 },
  locationTapMine:     { color: '#78350F' },
  locationTapTheirs:   { color: COLORS.accent },

  // ── Input bar ──
  inputBar: {
    flexDirection: 'row-reverse',
    alignItems: 'flex-end',
    paddingHorizontal: 10,
    paddingVertical: 10,
    borderTopWidth: 1,
    borderTopColor: COLORS.border,
    backgroundColor: COLORS.surface,
    gap: 6,
  },
  input: {
    flex: 1,
    backgroundColor: COLORS.bg,
    borderRadius: 22,
    paddingHorizontal: 16,
    paddingVertical: 10,
    color: COLORS.textPrimary,
    fontSize: 15,
    maxHeight: 120,
    borderWidth: 1,
    borderColor: COLORS.border,
  },
  sendBtn:         { backgroundColor: COLORS.accent, borderRadius: 22, paddingHorizontal: 14, paddingVertical: 10, minWidth: 60, alignItems: 'center', justifyContent: 'center' },
  sendBtnDisabled: { backgroundColor: COLORS.border },
  sendBtnText:     { fontSize: 13, fontWeight: '700', color: COLORS.bg },

  mediaBtn:     { width: 40, height: 40, alignItems: 'center', justifyContent: 'center', borderRadius: 20, backgroundColor: COLORS.bg, borderWidth: 1, borderColor: COLORS.border },
  mediaBtnIcon: { fontSize: 18 },

  // ── Recording HUD ──
  recordingHud: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    paddingHorizontal: 20,
    paddingVertical: 14,
    backgroundColor: '#1C0A0E',
    borderTopWidth: 1,
    borderTopColor: '#7F1D1D',
  },
  cancelRecordBtn: { paddingHorizontal: 16, paddingVertical: 8, borderRadius: 12, borderWidth: 1, borderColor: '#7F1D1D' },
  cancelRecordText:{ fontSize: 13, color: '#FCA5A5' },
  recordingInfo:   { flexDirection: 'row', alignItems: 'center', gap: 8 },
  recordingDot:    { width: 10, height: 10, borderRadius: 5, backgroundColor: '#EF4444' },
  recordingDuration:{ fontSize: 18, fontWeight: '700', color: '#F1F5F9', fontVariant: ['tabular-nums'] },
  sendRecordBtn:   { backgroundColor: COLORS.accent, paddingHorizontal: 16, paddingVertical: 8, borderRadius: 12 },
  sendRecordText:  { fontSize: 13, fontWeight: '700', color: COLORS.bg },

  // ── Uploading / closed bar ──
  uploadingBar:  { flexDirection: 'row', alignItems: 'center', justifyContent: 'center', gap: 10, paddingVertical: 16, backgroundColor: COLORS.surface, borderTopWidth: 1, borderTopColor: COLORS.border },
  uploadingText: { fontSize: 13, color: COLORS.textMuted },
  closedBar:     { paddingVertical: 16, backgroundColor: COLORS.surface, borderTopWidth: 1, borderTopColor: COLORS.border, alignItems: 'center', gap: 10 },
  closedBarText: { fontSize: 13, color: COLORS.textMuted },
  rateBtn:       { backgroundColor: '#F59E0B', paddingHorizontal: 20, paddingVertical: 8, borderRadius: 20 },
  rateBtnText:   { fontSize: 13, fontWeight: '700', color: '#0F172A' },

  voiceHint: { fontSize: 10, color: COLORS.textMuted, textAlign: 'center', paddingBottom: 4, backgroundColor: COLORS.surface },

  // ── Report modal ──
  reportOverlay:       { flex: 1, backgroundColor: 'rgba(0,0,0,0.6)', justifyContent: 'flex-end' },
  reportSheet:         { backgroundColor: COLORS.surface, borderTopLeftRadius: 24, borderTopRightRadius: 24, padding: 24 },
  reportTitle:         { fontSize: 18, fontWeight: '700', color: COLORS.textPrimary, textAlign: 'right', marginBottom: 4 },
  reportSubtitle:      { fontSize: 13, color: COLORS.textMuted, textAlign: 'right', marginBottom: 16 },
  reportOption:        { flexDirection: 'row', alignItems: 'center', gap: 12, paddingVertical: 12, paddingHorizontal: 4, borderBottomWidth: 1, borderBottomColor: COLORS.border },
  reportOptionSelected:{ backgroundColor: 'rgba(245,158,11,0.05)', borderRadius: 8 },
  reportRadio:         { width: 18, height: 18, borderRadius: 9, borderWidth: 2, borderColor: COLORS.border },
  reportRadioSelected: { borderColor: COLORS.accent, backgroundColor: COLORS.accent },
  reportOptionText:    { flex: 1, fontSize: 14, color: COLORS.textSecondary, textAlign: 'right' },
  reportOptionTextSelected: { color: COLORS.textPrimary, fontWeight: '600' },
  reportBtns:          { flexDirection: 'row', gap: 12, marginTop: 24 },
  reportCancelBtn:     { flex: 1, paddingVertical: 13, borderRadius: 12, borderWidth: 1, borderColor: COLORS.border, alignItems: 'center' },
  reportCancelText:    { fontSize: 14, color: COLORS.textMuted },
  reportSubmitBtn:     { flex: 1, backgroundColor: '#DC2626', borderRadius: 12, paddingVertical: 13, alignItems: 'center' },
  reportSubmitDisabled:{ backgroundColor: COLORS.surface, borderWidth: 1, borderColor: COLORS.border },
  reportSubmitText:    { fontSize: 14, fontWeight: '700', color: '#FFF' },
});
