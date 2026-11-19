import { useEffect, useRef, useState } from "react";
import { ArrowRight, CalendarDays, Camera, Check, CheckCheck, Globe, Inbox, MessageCircle, Pause, PhoneCall, Play, Sparkles } from "lucide-react";
import { Badge } from "../ui/badge";
import { Button, IconButton } from "../ui/button";
import { Chip, Switch } from "../ui/controls";
import { useSiteCopy } from "./copy";
import e from "./editorial.module.css";
import m from "./channel-map.module.css";

const icons = [MessageCircle, Camera, PhoneCall, Globe, Sparkles];
type Mode = "auto" | "review" | "booked";

export function ChannelMap() {
  const { site, channelExamples } = useSiteCopy();
  const board = useRef<HTMLDivElement>(null);
  const [visible, setVisible] = useState(false);
  const [selected, select] = useState(0);
  const [assistant, setAssistant] = useState(false);
  const [mode, setMode] = useState<Mode>("auto");
  const [paused, setPaused] = useState(false);
  const channel = channelExamples[selected];
  const Icon = icons[selected];
  useEffect(() => {
    if (!board.current || !("IntersectionObserver" in window)) return;
    const observer = new IntersectionObserver(([entry]) => setVisible(entry.isIntersecting));
    observer.observe(board.current);
    return () => observer.disconnect();
  }, []);

  function takeOver(index: number) {
    select(index);
    setMode("review");
  }

  const stopped = paused || mode !== "auto";
  return (
    <section id="channel-map" className={m.section} aria-labelledby="map-title">
      <div className={e.intro}><h2 id="map-title" className={e.display}>{site["map.heading"]}</h2><p>{site["map.intro"]}</p></div>
      <div ref={board} className={m.board} data-mode={mode} data-running={visible && !paused}>
        <div className={m.toolbar}>
          <div className={m.channels} role="group" aria-label={site["map.incoming"]}>
            {channelExamples.map(({ name }, i) => {
              const ChannelIcon = icons[i];
              return <Chip key={name} active={selected === i} onClick={() => takeOver(i)}>
                <ChannelIcon size={15} aria-hidden />{name}{"comingSoon" in channelExamples[i] && <small>{site["map.soon"]}</small>}
              </Chip>;
            })}
          </div>
          <IconButton variant="secondary" className={m.play} label={site[stopped ? "map.play" : "map.pause"]} onClick={() => {
            setPaused(!stopped);
            setMode("auto");
          }}>{stopped ? <Play size={15} aria-hidden /> : <Pause size={15} aria-hidden />}</IconButton>
        </div>
        <div className={m.sequence} key={channel.name}>
          <div className={m.scene}>
            <h3><Icon size={18} aria-hidden />{channel.source}</h3>
            <div className={m.origin} data-channel={selected}>
              <span className={m.source}><i><Icon size={16} aria-hidden /></i>{channel.name}</span>
              <p>{channel.request}</p>
            </div>
          </div>
          <ArrowRight className={m.arrow} size={20} aria-hidden />
          <div className={m.scene}>
            <h3><Inbox size={18} aria-hidden />{site["map.inbox"]}</h3>
            <div className={m.thread}>
              <div className={m.settings}><Switch showLabel label={site["map.assistant"]} checked={assistant} onChange={() => {
                setAssistant(!assistant);
                takeOver(selected);
              }} /></div>
              <div className={m.received}><Icon size={13} aria-hidden />{channel.request}</div>
              <div className={m.reply}><small>{site[assistant ? "map.draft" : "map.reply"]}</small><span>{channel.reply}</span></div>
              <Button variant="secondary" size="sm" className={m.book} onClick={() => setMode("booked")}>{site["map.book"]}<Check size={14} aria-hidden /></Button>
            </div>
          </div>
          <ArrowRight className={m.arrow} size={20} aria-hidden />
          <div className={m.scene}>
            <h3><CalendarDays size={18} aria-hidden />{site["hero.calendar"]}</h3>
            <div className={m.diary}>
              <div className={m.day}>{channel.day}</div>
              <div className={m.slot}><div><time>{channel.time}</time><Badge tone="accent" icon={Check}>{site["map.booked"]}</Badge></div><span>{channel.service}</span></div>
            </div>
            <div className={m.receipt} aria-live={mode === "auto" ? "off" : "polite"}><CheckCheck size={19} aria-hidden /><div><small>{site["map.confirmed"]}</small><span>{site["map.confirmationText"]} {channel.time}.</span></div></div>
          </div>
          <span className={m.clock} aria-hidden onAnimationEnd={() => select((selected + 1) % channelExamples.length)} />
        </div>
        <ol className={m.steps}>{(["arrive", "respond", "finish"] as const).map(step => <li key={step}>{site[`map.${step}`]}</li>)}</ol>
      </div>
    </section>
  );
}
