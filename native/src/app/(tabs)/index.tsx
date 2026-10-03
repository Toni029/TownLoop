import { router } from 'expo-router';
import { useSession } from '../../lib/session';
import { Page, Card, Heading, Body, Button } from '../../components/ui';
export default function Home() { const { profile } = useSession(); return <Page><Heading>Welcome, {profile?.name}</Heading><Card><Heading>Community Bulletin</Heading><Body>Announcements, upcoming events, and official gazette</Body><Button title="News" onPress={() => router.push('/news')}/></Card></Page>; }
