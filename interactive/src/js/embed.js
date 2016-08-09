import iframeMessenger from 'guardian/iframe-messenger'
import reqwest from 'reqwest'
import embedHTML from './text/embed.html!text'
import embedSVG from '../renderer/heptathlon.svg!text'

function $(el, s) {
    if (!s) { s = el; el = document; }
    return el.querySelector(s);
}

function $$(el, s) {
    if (!s) { s = el; el = document; }
    return [].slice.apply(el.querySelectorAll(s));
}

let drawIllus = (height, path, el) => {
    Array(7).fill().forEach((x, i) => {
        let img = document.createElement('img')
        img.setAttribute('src', `${path}/heptathlon-0${i+1}.svg`)
        img.setAttribute('class', 'hepta-illu')
        img.style.top = i*height - 15 + 'px'
        el.appendChild(img)
    })
}

let cubicEasing = t => {
    return x => {
        let a = -2/(t*t*t)
        let b = 3/(t*t)
        let d = 1
        return a*x*x*x + b*x*x + d
    }
}

let anims = {}

let start = null

let r = 5

let medalIds = ['7011724']

let easeInOut = null

let parseViewBoxWidth = (svgEl) => {

    return 700
}

let getScale = (svgElWidth, viewBoxWidth) => {
    return x => {
        return x*viewBoxWidth/svgElWidth
    }
}

let circles = null
let labels = null
let titles = null

function grow(circles, _id, ts) {

    if(!anims[_id]) {
        anims[_id] = { 'grow' : ts }
    } else if (!anims[_id].grow) {
        anims[_id].grow = ts
    }

    let progress = ts - anims[_id].grow

    if(progress < 150) {
        circles.forEach(c => c.setAttribute('r', r*easeInOut(progress)))
        window.requestAnimationFrame(ts => {
            grow(circles, _id, ts)
        })
    } else {
        delete anims[_id].grow
    }
}

function shrink(circles, _id, ts) {

    if(!anims[_id]) {
        anims[_id] = { 'shrink' : ts }
    } else if(!anims[_id].shrink) {
        anims[_id].shrink = ts
    }
    let progress = ts - anims[_id].shrink
    if(progress < 150) {
        circles.forEach(c => c.setAttribute('r', r/easeInOut(progress)*2))
        window.requestAnimationFrame(ts => {
            shrink(circles, _id, ts)
        })
    } else {
        delete anims[_id].shrink
    }
}

let highlight = (_id) => {
    $(`.hepta-line[data-id="${_id}"]`).classList.remove('hepta-hidden')
    let circles = $$(`.hepta-result-group[data-id="${_id}"] circle`)
    let labels = $$(`.hepta-result-group[data-id="${_id}"] text`)

    window.requestAnimationFrame(ts => {

        grow(circles, _id, ts)
    })
    circles.forEach(c => {
        c.classList.add('hepta-hl')
    })
    labels.forEach(l => {
        l.classList.remove('hepta-hidden')
    })
}

let unhighlight = (_id) => {
    $(`.hepta-line[data-id="${_id}"`).classList.add('hepta-hidden')
    let circles = $$(`.hepta-result-group[data-id="${_id}"] circle`)
    let labels = $$(`.hepta-result-group[data-id="${_id}"] text`)

    window.requestAnimationFrame(ts => {
        shrink(circles, _id, ts)
    })
    circles.forEach(c => {
        c.classList.remove('hepta-hl')
    })
    labels.forEach(l => {
        l.classList.add('hepta-hidden')
    })
}

let highlightMedals = () => {
    medalIds.forEach( _id => {

        highlight(_id)
    })
}

let unhighlightMedals = () => {
    medalIds.forEach( _id => {
        unhighlight(_id)
    })
}

let resizeSvgElements = (svg) => {
    let scale = getScale(svg.clientWidth, parseViewBoxWidth(svg))
        titles.forEach(t => t.setAttribute('font-size', scale(14)))
        labels.forEach(l => l.setAttribute('font-size', scale(12)))
        circles.forEach(c => c.setAttribute('r', scale(5)))
        r = scale(5)
}


let xScale = x => x*window.innerWidth/1024

window.init = function init(el, config) {

    iframeMessenger.enableAutoResize();

    el.innerHTML += embedSVG;

    let svg = $('svg')

    circles = $$('.hepta-result')
    labels = $$('.hepta-result-label')
    titles = $$('.hepta-discipline-title')

    easeInOut = cubicEasing(150)

    let h = $('svg').clientHeight/7
    drawIllus(h, `${config.assetPath}/assets/imgs`, el)

    $$('.hepta-voronoi').forEach(function(e) {

        let _id = e.getAttribute('data-id')

    	e.addEventListener('mouseenter', function(e) {
        	highlight(_id)
    	})
        e.addEventListener('mouseleave', function(e) {
            unhighlight(_id)
        })
    })

    $('svg').addEventListener('mouseleave', () => {
        highlightMedals()
    })

    $('svg').addEventListener('mouseenter', () => {
        unhighlightMedals()
    })

    highlightMedals()

};
