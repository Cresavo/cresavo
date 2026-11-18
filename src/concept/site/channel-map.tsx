import { useState } from "react";
import { ArrowRight, Camera, Check, Globe, MessagesSquare, Phone, Repeat2, Undo2 } from "lucide-react";
import { channelExamples, site } from "./en";
import m from "./channel-map.module.css";

const icons = [MessagesSquare, Camera, Phone, Globe, Repeat2];

function ChannelWires({ selected }: { selected: number }) {
  return (
    <>
      <svg className={m.wires} viewBox="0 0 100 250" preserveAspectRatio="none" aria-hidden="true">
        {channelExamples.map(({ name }, index) => {
          const y = 25 + index * 50;
          return <path key={name} data-active={index === selected}
            d={`M0 ${y} C55 ${y} 40 125 90 125 H100`} vectorEffect="non-scaling-stroke" />;
        })}
      </svg>
      <svg className={m.mobileWires} viewBox="0 0 250 28" preserveAspectRatio="none" aria-hidden="true">
        {channelExamples.map(({ name }, index) => {
          const x = 25 + index * 50;
          return <path key={name} data-active={index === selected}
            d={`M${x} 0 C${x} 18 125 9 125 28`} vectorEffect="non-scaling-stroke" />;
        })}
      </svg>
    </>
  );
}

export function ChannelMap() {
  const [selected, select] = useState(0);
  const [assistant, setAssistant] = useState(false);
  const [replies, setReplies] = useState<Partial<Record<number, string>>>({});
  const [sent, setSent] = useState<Partial<Record<number, string>>>({});
  const channel = channelExamples[selected];
  const reply = replies[selected] ?? "";
  const sentReply = sent[selected];
  const outgoing = assistant ? channel.draft : reply.trim();

  return (
    <section id="channel-map" className={m.section} aria-labelledby="map-title">
      <div className={m.intro}><h2 id="map-title">{site["map.heading"]}</h2><p>{site["map.intro"]}</p></div>
      <div className={m.map}>
        <div className={m.bar}>
          <span>{site["mini.salon"]} <i aria-hidden>/</i> {site["map.nav"]}</span>
          <small>{site["map.preview"]}</small>
        </div>
        <div className={m.flow}>
          <div className={m.inputs} role="group" aria-label={site["map.incoming"]}>
            <small className={m.inputLabel}>{site["map.incoming"]}</small>
            <div className={m.channelList}>
              {channelExamples.map(({ name }, index) => {
                const Icon = icons[index];
                return <button key={name} type="button" aria-pressed={index === selected} onClick={() => select(index)}>
                  <Icon size={16} strokeWidth={1.65} aria-hidden />{name}
                </button>;
              })}
            </div>
          </div>
          <ChannelWires selected={selected} />
          <div className={m.inbox}>
            <div className={m.inboxHead}>
              <strong>{site["map.inbox"]}</strong>
              <button type="button" role="switch" aria-checked={assistant} aria-label={site["map.assistant"]}
                onClick={() => setAssistant(!assistant)}>
                {site["map.assistant"]}: {site[assistant ? "map.on" : "map.off"]}<span aria-hidden />
              </button>
            </div>
            <div className={m.message}>
              <small>{"comingSoon" in channel ? site["map.agentRequest"] : `${channel.name} ${site["map.request"]}`}</small>
              <blockquote>“{channel.request}”</blockquote>
              {sentReply ? <div className={m.composer}>
                <small>{site["map.sent"]}</small><p>{sentReply}</p>
                <button className={m.action} onClick={() => setSent({ ...sent, [selected]: "" })}>{site["map.undo"]}<Undo2 size={15} aria-hidden /></button>
              </div> : <div className={m.composer}>
                {assistant ? <><small>{site["map.draft"]}</small><p>“{channel.draft}”</p></> :
                  <label><small>{site["map.reply"]}</small>
                    <textarea rows={2} value={reply} placeholder={site["map.placeholder"]}
                      onChange={event => setReplies({ ...replies, [selected]: event.target.value })} />
                  </label>}
                <button className={m.action} disabled={!outgoing} onClick={() => setSent({ ...sent, [selected]: outgoing })}>
                  {site[assistant ? "map.approve" : "map.send"]}<ArrowRight size={16} aria-hidden />
                </button>
              </div>}
            </div>
          </div>
          <div className={m.arrow} aria-hidden><ArrowRight size={20} /></div>
          <div className={m.slot} data-booked={!!sentReply} aria-live="polite" aria-atomic="true">
            <strong>{site["hero.calendar"]}</strong>
            <div><small>{channel.day}</small><time>{channel.time}</time><span>{channel.service}</span></div>
            <p className={m.slotStatus}>{sentReply && <Check size={15} aria-hidden />}{site[sentReply ? "map.booked" : "map.proposed"]}</p>
          </div>
        </div>
      </div>
      <p className={m.footnote}>{site["map.agentSoon"]}</p>
    </section>
  );
}
