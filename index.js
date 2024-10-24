let board = null
let $board = $('#myBoard')
let game = new Chess()
let puzzle  = null
let moves  = null
let orientation = null
let counter = undefined
let promoting = false
let promotingTo = 'q'
let history = []

const moveSound = new Audio('move.mp3')
const captureSound = new Audio('capture.mp3')
const squareClass = 'square-55d63'
const whiteSquareGrey = '#a9a9a9'
const blackSquareGrey = '#696969'

const $countdownContainer = $('#countdownContainer')
$countdownContainer.hide()
const $countdown = $('#countdown')
const $loading = $('#loading')
const $loadingText = $('#loadingText')
const $promotionDialog = $('#promotion-dialog')
$promotionDialog.hide()
const $memo = $('#memo')
const $theme = $('#theme')
const $rating = $('#rating')
const $easyMode = $('#easyMode')
const $giveUp = $('#giveUp')
const $retry = $('#retry')
const $next = $('#next')
const $correct = $('#correct')
const $incorrect = $('#incorrect')
const $pgn = $('#pgn')
const getImgSrc = piece => `img/chesspieces/${$theme.val()}/{piece}.png`.replace('{piece}', game.turn() + piece.toLocaleUpperCase())

function removeGreySquares () {
    $('#myBoard .square-55d63').css('background', '')
}

function greySquare (square) {
    let $square = $('#myBoard .square-' + square)

    let background = whiteSquareGrey
    if ($square.hasClass('black-3c85d')) {
        background = blackSquareGrey
    }

    $square.css('background', background)
}

function onDragStart(source, piece) {
    // do not pick up pieces if the game is over
    if (game.game_over()) return false

    // only pick up pieces for the side to move
    if ((game.turn() === 'w' && piece.search(/^b/) !== -1) ||
        (game.turn() === 'b' && piece.search(/^w/) !== -1)) {
        return false
    }
}

function onDrop(source, target) {
    removeGreySquares()

    const position = game.fen()
    const piece = game.get(source).type

    // see if the move is legal
    let move = game.move({
        from: source,
        to: target,
        promotion: promotingTo
    })

    // illegal move
    if (move === null) return 'snapback'

    const sourceRank = source.charAt(1)
    const targetRank = target.charAt(1)

    if (!promoting && piece === 'p'
        && ((sourceRank === '7' && targetRank === '8') || (sourceRank === '2' && targetRank === '1'))) {
        // undo the last move to allow for piece selection
        game.undo()

        // set the color of pieces in the modal
        $('.promotion-piece-q').attr('src', getImgSrc('q'))
        $('.promotion-piece-r').attr('src', getImgSrc('r'))
        $('.promotion-piece-n').attr('src', getImgSrc('n'))
        $('.promotion-piece-b').attr('src', getImgSrc('b'))
        $promotionDialog.attr('data-source', source)
        $promotionDialog.attr('data-target', target)
        $promotionDialog.show()
        $promotionDialog.position({ of: $board, my: 'center center', at: 'center center' })
        $board.css('pointer-events', 'none')

        promoting = true

        return 'snapback'
    }

    if (move.captured) captureSound.play()
    else moveSound.play()

    // incorrect move
    if ((!moves[counter].includes(source + target) && !game.in_checkmate()) || (promoting && !moves[counter].endsWith(promotingTo))) {
        const movesToNow = game.pgn().split('\n').splice(3)[0]

        // display position after incorrect move
        board = Chessboard('myBoard', {
            ...config,
            orientation,
            draggable: false,
            position: game.fen()
        })

        // revert to position before incorrect move
        board.position(position)
        game.load(position)

        showSolution(movesToNow)

        $giveUp.hide()
        $incorrect.show()
        $retry.show()
        $easyMode.attr('disabled', false)
        $next.show()

        return 'snapback'
    }

    if (move.promotion) onSnapEnd()

    updateStatus()
}

// update the board position after the piece snap
// for castling, en passant, pawn promotion
function onSnapEnd() {
    if (++counter === moves.length) { // puzzle finished
        board = Chessboard('myBoard', {
            ...config,
            orientation,
            draggable: false,
            position: game.fen()
        })
        $giveUp.hide()
        $correct.show()
        $retry.show()
        $easyMode.attr('disabled', false)
        $next.show()

        return
    }

    // make the next move in the puzzle
    const move = game.move(moves[counter++], { sloppy : true })
    if (move.captured) captureSound.play()
    else moveSound.play()

    highlightMove(move)
    board.position(game.fen())

    updateStatus()
}

function onMouseoverSquare (square) {
    if ($easyMode.is(':checked') && $giveUp.is(':visible')) {
        // get list of possible moves for this square
        let moves = game.moves({
            square: square,
            verbose: true
        })

        // exit if there are no moves available for this square
        if (moves.length === 0) return

        // highlight the square they moused over
        greySquare(square)

        // highlight the possible squares for this piece
        for (let i = 0; i < moves.length; i++) {
            greySquare(moves[i].to)
        }
    }
}

function getStatus(prefix) {
    if (prefix) {
        let status = game.pgn().split('\n').splice(3)[0]
        const dots = status.indexOf('...')
        if (dots !== -1) status = status.substring(dots + 4)
        return prefix + ' ' + status
    } else {
        return game.pgn().split('\n').splice(3)[0]
    }
}

function updateStatus(prefix) {
    if (prefix) {
        let status = game.pgn().split('\n').splice(3)[0]
        const dots = status.indexOf('...')
        if (dots !== -1) status = status.substring(dots + 4)
        $pgn.html(prefix + ' ' + status)
    } else {
        $pgn.html(game.pgn().split('\n').splice(3)[0])
    }
}

function getPuzzle(p) {
    $.get('lichess_db_puzzle_' + $rating.val() + '.csv', csv => {
        const data = csv.split('\n')

        // get random puzzle
        puzzle = p ?? data[Math.floor(Math.random() * data.length)].split(',')

        game.load(puzzle[1])
        moves = puzzle[2].split(' ')
        orientation = game.turn() === 'b' ? 'white' : 'black'

        $loading.hide()
        $loadingText.hide()

        board = Chessboard('myBoard', {
            ...config,
            orientation,
            draggable: false,
            position: puzzle[1]
        })

        // make first move of the puzzle
        const move = game.move(moves[0], { sloppy: true })
        if (move.captured) captureSound.play()
        else moveSound.play()
        counter = 1

        highlightMove(move)
        board.position(game.fen())

        updateStatus()
    }).then(() => {
        // queue remove pieces after memorization time
        setTimeout(() => {
            board = Chessboard('myBoard', {
                ...config,
                orientation,
                draggable: true,
                position: game.fen(),
                pieceTheme: 'img/chesspieces/blindfold.png'
            })
            $(`img[data-piece^=${game.turn()}]`).css('cursor', 'pointer')
            $easyMode.attr('disabled', true)
            $giveUp.show()
        }, 1000 * $memo.val())

        $countdownContainer.show()

        let countdown = $memo.val()
        $countdown.html(countdown)
        const interval = setInterval(() => {
            if (countdown == 1) {
                $countdownContainer.hide()
                clearInterval(interval)
            }
            $countdown.html(--countdown)
        }, 1000)
    })
}

let timeouts = []

function showSolution(movesToNow) {
    if (movesToNow) {
        movesToNow = movesToNow.substring(0, movesToNow.lastIndexOf(' '))
        if (movesToNow.endsWith('.')) movesToNow = movesToNow.substring(0, movesToNow.lastIndexOf(' '))
    }
    for (let i = counter; i < moves.length; i++) {
        timeouts[i] = setTimeout(() => {
            const move = game.move(moves[i], { sloppy : true })
            board.position(game.fen())
            if (move.captured) captureSound.play()
            else moveSound.play()
            updateStatus(movesToNow)
        }, (i - counter + 1) * 1000)
    }
}

function clearTimeouts() {
    for (let i = counter; i < timeouts.length; i++)
        clearTimeout(timeouts[i])
}

function highlightMove(move) {
    $board.find('.' + squareClass).removeClass('highlight-black')
    $board.find('.square-' + move.from).addClass('highlight-black')
    $board.find('.square-' + move.to).addClass('highlight-black')
}

const config = {
    onDragStart,
    onDrop,
    onSnapEnd,
    onMouseoutSquare: removeGreySquares,
    onMouseoverSquare
}

const memo = localStorage.getItem('memo')
if (memo)
    $memo.val(memo)
else
    $memo.val(5)
$memo.on('input', () => {
    localStorage.setItem('memo', $memo.val())
})

$('#promote-to li').click(function() {
    $promotionDialog.hide()
    promotingTo = $(this).find('span').text()
    $board.css('pointer-events', 'auto')
    onDrop($promotionDialog.attr('data-source'),$promotionDialog.attr('data-target'))
    promoting = false
})

const theme = localStorage.getItem('theme')
if (theme) {
    $theme.val(theme)
    config.pieceTheme = `img/chesspieces/${theme}/{piece}.png`
} else {
    $theme.val('wikipedia')
    config.pieceTheme = `img/chesspieces/wikipedia/{piece}.png`
}
$theme.on('change', () => {
    config.pieceTheme = `img/chesspieces/${$theme.val()}/{piece}.png`
    if ($giveUp.is(':hidden') || $next.is(':visible')) {
        board = Chessboard('myBoard', {
            ...config,
            orientation,
            draggable: false,
            position: board.fen(),
            pieceTheme: `img/chesspieces/${$theme.val()}/{piece}.png`
        })
    }
    $('.promotion-piece-q').attr('src', getImgSrc('q'))
    $('.promotion-piece-r').attr('src', getImgSrc('r'))
    $('.promotion-piece-n').attr('src', getImgSrc('n'))
    $('.promotion-piece-b').attr('src', getImgSrc('b'))
    localStorage.setItem('theme', $theme.val())
})

const rating = localStorage.getItem('rating')
if (rating) {
    $rating.val(rating)
} else {
    $rating.val('1400-1599')
}
$rating.on('change', () => {
    localStorage.setItem('rating', $rating.val())
})

$giveUp.hide()
$giveUp.click(() => {
    board = Chessboard('myBoard', {
        ...config,
        orientation,
        draggable: false,
        position: game.fen()
    })
    showSolution()
    $giveUp.hide()
    $retry.show()
    $easyMode.attr('disabled', false)
    $next.show()
})

$retry.hide()
$retry.click(() => {
    clearTimeouts()
    getPuzzle(puzzle)
    $correct.hide()
    $incorrect.hide()
    $retry.hide()
    $next.hide()
})

$next.hide()
$next.click(() => {
    clearTimeouts()
    getPuzzle()
    $correct.hide()
    $incorrect.hide()
    $retry.hide()
    $next.hide()
})

$correct.hide()
$incorrect.hide()

$(document).keydown(function (e) {
    const move = game.undo()
    game.move(move)

    if (history.length === 0 && (!move || move.from + move.to + (move.promotion ?? '') !== moves[moves.length - 1])) return

    if (e.keyCode === 37) {
        const m1 = game.undo()
        const m2 = game.undo()
        if (!m2) {
            game.move(m1)
            return
        }
        game.move(m2)
        history.push(m1)
        board.position(game.fen())
    } else if (e.keyCode === 39) {
        game.move(history.pop())
        board.position(game.fen())
    } else {
        return
    }
    let html = $pgn.html().replaceAll('<strong>', '')
    html = html.replaceAll('</strong>', '')
    const end = html.split(getStatus())[1] ?? ''
    const start = html.slice(0, -end.length)
    const past = start.split(' ')
    const bold = past[past.length - 1]
    if (bold.trim().length === 0) {
        let all = html.split(' ')
        const last = all.pop()
        $pgn.html(all.join(' ') + ' <strong>' + last + '</strong>')
        return
    }
    $pgn.html(start.slice(0, -bold.length) + '<strong>' + bold + '</strong>' + end)
})

getPuzzle()