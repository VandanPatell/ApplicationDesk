const template=(name,color,font,layout,description,category='Professional',featured=false)=>({name,color,font,layout,description,category,featured});
export const resumeThemes=[
 template('Atlas','#183f51','Helvetica','sidebar','A confident sidebar for contact details, skills and languages.','Professional',true),
 template('Executive','#292f38','Times-Roman','executive','Centered serif typography, fine rules and a composed hierarchy.','Professional',true),
 template('Swiss','#b14e36','Helvetica','swiss','Strong typography with section labels in a dedicated left rail.','Modern',true),
 template('Studio','#285c59','Helvetica','banner','A bold masthead and generous spacing for a contemporary resume.','Modern',true),
 template('Technical','#285a87','Helvetica','technical','Numbered sections, a structured skills panel and clear project details.','Modern',true),
 template('Compact','#252525','Helvetica','compact','A restrained single-column layout that makes careful use of space.','Minimal',true),
 template('Classic','#252525','Times-Roman','classic','Traditional serif headings with a clean, left-aligned structure.'),
 template('Modern','#263e55','Helvetica','banner','A navy masthead with contemporary sans-serif typography.','Modern'),
 template('Editorial','#514036','Times-Roman','editorial','An elegant serif-led layout with warm accents and generous margins.'),
 template('Minimal','#353535','Helvetica','minimal','Unadorned typography with subtle section markers.','Minimal'),
 template('Slate','#475569','Helvetica','swiss','A slate section rail for an orderly, understated presentation.','Modern'),
 template('Forest','#315744','Times-Roman','sidebar','A deep green sidebar paired with a classic serif body.'),
 template('Ocean','#245776','Helvetica','banner','A blue masthead, clear labels and ample white space.','Modern'),
 template('Burgundy','#783d48','Times-Roman','executive','A centered executive layout with a subtle burgundy accent.'),
 template('Sand','#826641','Times-Roman','editorial','Warm editorial typography and a quiet, spacious rhythm.'),
 template('Midnight','#343661','Helvetica','sidebar','A dark indigo sidebar with a crisp sans-serif main column.','Modern'),
 template('Terracotta','#9a523c','Times-Roman','editorial','An expressive serif layout with a terracotta rule and section titles.'),
 template('Monochrome','#111111','Helvetica','compact','A compact, single-column presentation in black and white.','Minimal')
];
export const fontFiles={
 Lato:'Lato-Regular.ttf',LatoBold:'Lato-Bold.ttf',LatoItalic:'Lato-Italic.ttf',
 PTSerif:'PTSerif-Regular.ttf',PTSerifBold:'PTSerif-Bold.ttf',PTSerifItalic:'PTSerif-Italic.ttf'
};
