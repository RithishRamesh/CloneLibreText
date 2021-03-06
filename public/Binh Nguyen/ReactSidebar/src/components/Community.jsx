import React from 'react';
import {Divider, Link, List, ListItem, ListItemIcon, ListItemText} from "@material-ui/core";
import {IconLink} from "./Common.jsx";
import PropTypes from "prop-types";

export default function Community(props) {
    let forums = {...LibreTexts.libraries};
    delete forums.Query;
    forums = Object.entries(forums);
    
    return (<List>
        <IconLink title="YouTube Channel" icon="mt-icon-youtube"
                  href="https://www.youtube.com/channel/UCP7H_PcHpiINWs8qpg0JaNg"/>
        <IconLink title="Office Hours" icon="mt-icon-topic" href="https://blog.libretexts.org/2019/06/13/libretexts-offers-new-weekly-office-hours/"/>
        <IconLink title="Blog" icon="fas fa-info" href="https://blog.libretexts.org/"/>
        <IconLink title="Community Help Chat" icon="mt-icon-chat2" href="https://chat.libretexts.org/"/>
        <Divider/>
        <IconLink title="Twitter" icon="mt-icon-twitter"
                  href="https://twitter.com/LibreTexts?ref_src=twsrc%5Egoogle%7Ctwcamp%5Eserp%7Ctwgr%5Eauthor"/>
        <IconLink title="Facebook" icon="mt-icon-facebook" href="https://www.facebook.com/LibreTexts/"/>
    
        <Divider/>
        {forums.map((entry, index) => (
            <CommunityLibraryItem key={entry[1]} text={entry[0]} subdomain={entry[1]}/>
        ))}
    </List>);
}

function CommunityLibraryItem(props) {
    return (
        <ListItem button key={props.text} component={Link}
                  href={`https://forums.libretexts.org/g/Community${props.text}/topics`}
                  rel="external nofollow"
                  target="_blank"
                  className="SidebarItem">
            <ListItemIcon><img className="icon" alt=""
                               src={`https://libretexts.org/img/LibreTexts/glyphs_blue/${props.subdomain}.png`}/></ListItemIcon>
            <ListItemText primary={props.text + " Forum"}/>
        </ListItem>)
}
CommunityLibraryItem.propTypes = {
    text: PropTypes.string.isRequired,
    href: PropTypes.string,
    icon: PropTypes.string,
    onClick: PropTypes.func,
}
