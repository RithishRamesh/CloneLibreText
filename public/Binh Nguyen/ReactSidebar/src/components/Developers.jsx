import React from 'react';
import {List, ListItem, ListItemIcon, ListItemText} from "@material-ui/core";
import {IconLink, LibraryItem, TableOfContents} from "./Common.jsx";
import Accordion from '@material-ui/core/Accordion';
import AccordionSummary from '@material-ui/core/AccordionSummary';
import AccordionDetails from '@material-ui/core/AccordionDetails';
import Typography from '@material-ui/core/Typography';
import ExpandMoreIcon from '@material-ui/icons/ExpandMore';

export default function Developers(props) {
    let tags = document.getElementById('pageTagsHolder').innerText;
    const allowMatter = tags.includes('coverpage:yes') || tags.includes('coverpage:toc');
    
    return (<List>
	 
		<Accordion>
		<AccordionSummary
		    expandIcon={<ExpandMoreIcon/>}
		    aria-controls="panel1a-content"
		>
		    <ListItemLink>
			<ListItemIcon className="mt-icon-site-tools"></ListItemIcon>
			<ListItemText primary="Construction Guide"/>
		    </ListItemLink>
		</AccordionSummary>
		<AccordionDetails>
		    <TableOfContents
			coverpageURL={"https://chem.libretexts.org/Courses/Remixer_University/LibreTexts_Construction_Guide"}/>
		</AccordionDetails>
	    </Accordion>

	    
            <IconLink title="Get Text Cover" icon="mt-icon-book" onClick={() => {
                cover(window.location.href)
            }}/>
            <IconLink title="Reveal Answers" icon="mt-icon-eye3" onClick={() => {
                $('dd').show();
            }}/>
            <IconLink title="Reset Page Order" icon="mt-icon-shuffle" onClick={() => {
                LibreTexts.authenticatedFetch(null, 'unorder', null, {method: 'PUT'});
                window.location.reload();
            }}/>
            <IconLink title="Get PageIDs" icon="mt-icon-flow-cascade" onClick={() => {
                LibreTexts.getSubpages().then(data => {
                    data = JSON.stringify(data).match(/"id":"\d+"/g);
                    if (data) {
                        data = data.map(e => e.match(/"id":"(\d+)"/)[1]);
                    }
                    else {
                        data = [document.getElementById("IDHolder")?.innerText];
                    }
                    let [subdomain] = LibreTexts.parseURL();
                    data = data.map(e => subdomain + "-" + e);
                    navigator.clipboard.writeText(data.join(", "))
                    console.log(data.join(", "));
                    alert("Copied pageIDs to the clipboard");
                })
            }}/>
            {allowMatter ? <IconLink title="Generate Front/Back Matter" icon="mt-icon-book2" onClick={() => {
                batch(window.location.href, '&createMatterOnly=true');
            }}/> : null}
            <IconLink title="Construction Forum" icon="mt-icon-archive"
                      href="https://groups.io/g/Libretexts-ConstructionForum"/>
            <IconLink title="Jupyter Hub" icon="fas fa-square-root-alt" href="https://jupyter.libretexts.org/hub/login"/>
            <IconLink title="Webwork Server" icon="fas fa-square-root-alt" href="https://webwork.libretexts.org/webwork2"/>
            <IconLink title="IMathAS Server" icon="mt-icon-article" href="https://imathas.libretexts.org/imathas/"/>
            <IconLink title="RealTime Mathjax" icon="mt-icon-article"
                      href="https://chem.libretexts.org/Under_Construction/Development_Details/Misc_Pages/Realtime_MathJax"/>
            <IconLink title="LibreMaps" icon="mt-icon-archive" href="https://libremaps.libretexts.org/"/>
        </List>
    );
}

function ListItemLink(props) {
  return <ListItem button component="a" {...props} />;
}
